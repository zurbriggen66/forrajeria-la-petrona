import { useState } from 'react'
import { Check, ImageOff, Loader2, Search, TrendingUp, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Input } from '../../components/ui/Input'
import { InputDecimal } from '../../components/ui/InputDecimal'
import { Paginacion } from '../../components/ui/Paginacion'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney, parseDecimal } from '../../lib/format'
import { useAplicarAjuste, useCategorias, useProductos, useProveedores } from './api'
import type { Producto } from './types'

type Tipo = 'porcentaje' | 'monto'

/** Cuántas tarjetas por página en la galería. Menos que en la tabla (50): acá
 * cada producto ocupa una tarjeta con foto, y una grilla de 50 no se recorre. */
const POR_PAGINA = 24

/** Un producto elegido, con el ajuste propio que le puso el dueño.
 * `valorTexto` vacío = va con el valor general. */
interface Elegido {
  producto: Producto
  valorTexto: string
}

/** Precio después del ajuste. Espeja lo que hace el backend en
 * productos/views.py::AjustePrecioViewSet.create — el server siempre recalcula,
 * esto es para mostrar el mismo número antes de confirmar. */
function precioAjustado(precioActual: number, tipo: Tipo, valor: number): number {
  const nuevo = tipo === 'porcentaje' ? precioActual * (1 + valor / 100) : precioActual + valor
  // Un descuento grande no puede mostrar un precio negativo (el backend lo
  // corta en 0 igual).
  return Math.max(Math.round(nuevo * 100) / 100, 0)
}

/** Miniatura del producto. La mayoría del catálogo no tiene foto cargada, así
 * que el respaldo tiene que ser reconocible y no un cuadro vacío: la inicial
 * del nombre alcanza para distinguir de un vistazo. */
function Miniatura({ producto }: { producto: Producto }) {
  const [falló, setFalló] = useState(false)

  if (producto.imagen_url && !falló) {
    return (
      <img
        src={producto.imagen_url}
        alt={producto.nombre}
        loading="lazy"
        onError={() => setFalló(true)}
        className="h-24 w-full rounded-lg object-cover"
      />
    )
  }
  return (
    <div className="flex h-24 w-full items-center justify-center rounded-lg bg-surface-2">
      {producto.nombre ? (
        <span className="font-display text-2xl font-bold text-text-dim">
          {producto.nombre.trim().charAt(0).toUpperCase()}
        </span>
      ) : (
        <ImageOff size={20} className="text-text-dim" />
      )}
    </div>
  )
}

export function Aumentos() {
  const { toast } = useToast()
  const { data: categorias } = useCategorias()
  const { data: proveedores } = useProveedores()
  const aplicar = useAplicarAjuste()

  const [categoria, setCategoria] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<Tipo>('porcentaje')
  const [valor, setValor] = useState('')
  // La selección sobrevive el cambio de página y de categoría a propósito: una
  // suba de proveedor toca productos de varias categorías, y perder lo elegido
  // al pasar de página obligaría a hacerlo en varias tandas.
  const [elegidos, setElegidos] = useState<Map<string, Elegido>>(new Map())
  const [confirmando, setConfirmando] = useState(false)
  // Qué tarjetas tienen abierto el campo de "% propio". Cerrado por defecto: el
  // caso normal es un solo porcentaje para todos los elegidos, y un input por
  // tarjeta hacía creer que había que llenarlos uno por uno.
  const [conValorPropio, setConValorPropio] = useState<Set<string>>(new Set())

  const { data, isLoading, isFetching } = useProductos({
    categoria: categoria || undefined,
    search: busqueda || undefined,
    activo: true,
    ordering: 'nombre',
    page: pagina,
    page_size: POR_PAGINA,
  })
  const productos = data?.results ?? []

  const valorGeneral = parseDecimal(valor)
  const seleccionados = [...elegidos.values()]

  function reiniciarPagina<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPagina(1)
    }
  }

  function alternarValorPropio(id: string) {
    setConValorPropio((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  function alternar(producto: Producto) {
    setElegidos((prev) => {
      const siguiente = new Map(prev)
      if (siguiente.has(producto.id)) siguiente.delete(producto.id)
      else siguiente.set(producto.id, { producto, valorTexto: '' })
      return siguiente
    })
  }

  function cambiarValorIndividual(producto: Producto, valorTexto: string) {
    setElegidos((prev) => {
      const siguiente = new Map(prev)
      siguiente.set(producto.id, { producto, valorTexto })
      return siguiente
    })
  }

  function elegirVisibles() {
    setElegidos((prev) => {
      const siguiente = new Map(prev)
      for (const p of productos) if (!siguiente.has(p.id)) siguiente.set(p.id, { producto: p, valorTexto: '' })
      return siguiente
    })
  }

  function quitarVisibles() {
    setElegidos((prev) => {
      const siguiente = new Map(prev)
      for (const p of productos) siguiente.delete(p.id)
      return siguiente
    })
  }

  /** Cuánto sube (o baja) la lista de precios con lo elegido. Es el número que
   * el dueño quiere ver antes de apretar: "esto me mueve la lista $X".
   *
   * Sin useMemo a propósito: la selección es un Map nuevo en cada cambio, así
   * que el memo nunca acertaba y sólo agregaba una dependencia que mentía. */
  const impacto = { antes: 0, despues: 0 }
  for (const { producto, valorTexto } of seleccionados) {
    const actual = parseDecimal(producto.precio_venta)
    const v = valorTexto.trim() === '' ? valorGeneral : parseDecimal(valorTexto)
    impacto.antes += actual
    impacto.despues += precioAjustado(actual, tipo, v)
  }

  const sinSeleccion = seleccionados.length === 0
  const alcance = sinSeleccion
    ? `todos los productos activos de ${categoria || 'todas las categorías'}${proveedor ? ' de ese proveedor' : ''}`
    : `${seleccionados.length} producto${seleccionados.length === 1 ? '' : 's'} elegido${seleccionados.length === 1 ? '' : 's'}`

  async function aplicarAjuste() {
    try {
      const res = await aplicar.mutateAsync({
        descripcion,
        tipo,
        valor,
        categoria: categoria || undefined,
        proveedor: proveedor || undefined,
        // Sin nada elegido se manda sólo el filtro y el backend le pega a toda
        // la categoría: es el camino de siempre, y una sola request sin importar
        // cuántos productos haya.
        productos: sinSeleccion
          ? undefined
          : seleccionados.map(({ producto, valorTexto }) => (
            valorTexto.trim() === ''
              ? { producto: producto.id }
              : { producto: producto.id, valor: valorTexto }
          )),
      })
      toast(`Se actualizaron ${res.cant_productos} producto${res.cant_productos === 1 ? '' : 's'}`)
      setElegidos(new Map())
      setDescripcion('')
      setValor('')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo aplicar el ajuste'), 'error')
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1 — Qué ajuste y sobre qué categoría */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Select
            id="categoria" label="Categoría"
            value={categoria} onChange={(e) => reiniciarPagina(setCategoria)(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias?.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </Select>
          <Select
            id="proveedor" label="Proveedor"
            value={proveedor} onChange={(e) => reiniciarPagina(setProveedor)(e.target.value)}
          >
            <option value="">Todos los proveedores</option>
            {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
          <Select id="tipo" label="Tipo de ajuste" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto">Monto fijo ($)</option>
          </Select>
          <Input
            id="descripcion" label="Descripción (opcional)" placeholder="Ej: aumento agosto"
            value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <p className="mt-2 text-xs text-text-dim">
          Tocá los productos que querés ajustar y poné un solo valor abajo — se aplica a todos los elegidos.
          En negativo es un descuento: <span className="text-text">-15</span> baja los precios un 15%.
        </p>
      </div>

      {/* 2 — La galería */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              value={busqueda}
              onChange={(e) => reiniciarPagina(setBusqueda)(e.target.value)}
              placeholder="Buscar dentro de la categoría…"
              className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            {isFetching && <Loader2 size={14} className="animate-spin text-text-dim" />}
            <Button type="button" variant="ghost" onClick={elegirVisibles} className="!px-2 !py-1 text-xs">
              Elegir los de esta página
            </Button>
            <Button type="button" variant="ghost" onClick={quitarVisibles} className="!px-2 !py-1 text-xs">
              Quitar los de esta página
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
            <Loader2 size={16} className="animate-spin" /> Cargando productos…
          </div>
        ) : productos.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-dim">
            No hay productos activos que coincidan.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {productos.map((producto) => {
              const elegido = elegidos.get(producto.id)
              const actual = parseDecimal(producto.precio_venta)
              const v = !elegido || elegido.valorTexto.trim() === '' ? valorGeneral : parseDecimal(elegido.valorTexto)
              const nuevo = precioAjustado(actual, tipo, v)
              return (
                <div
                  key={producto.id}
                  className={`flex flex-col gap-2 rounded-xl border p-2 transition-colors ${
                    elegido ? 'border-accent bg-accent/5' : 'border-border bg-surface-2/40 hover:border-accent/40'
                  }`}
                >
                  {/* La tarjeta entera alterna: en una tablet es un área de
                      toque cómoda, y el tilde de arriba a la derecha dice el
                      estado sin tener que leer el borde. */}
                  <button type="button" onClick={() => alternar(producto)} className="relative text-left">
                    <Miniatura producto={producto} />
                    <span
                      className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                        elegido ? 'border-accent bg-accent text-accent-ink' : 'border-border bg-bg/70 text-transparent'
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <p className="mt-1.5 line-clamp-2 min-h-8 text-xs font-medium leading-tight text-text">
                      {producto.nombre}
                    </p>
                  </button>

                  <div className="flex items-baseline justify-between gap-1 text-xs">
                    <span className="tabular-nums text-text-dim line-through">{formatMoney(actual)}</span>
                    <span className={`tabular-nums font-semibold ${
                      nuevo > actual ? 'text-accent-2' : nuevo < actual ? 'text-warning' : 'text-text-dim'
                    }`}>
                      {formatMoney(nuevo)}
                    </span>
                  </div>

                  {/* El % propio es la excepción, no el paso obligado: cerrado
                      por defecto, se abre por tarjeta al que lo necesita. */}
                  {elegido && (conValorPropio.has(producto.id) || elegido.valorTexto !== '' ? (
                    <div className="flex items-center gap-1">
                      <InputDecimal
                        aria-label={`Ajuste propio de ${producto.nombre}`}
                        placeholder={valor || '0'}
                        value={elegido.valorTexto}
                        onChange={(nuevoValor) => cambiarValorIndividual(producto, nuevoValor)}
                        className="!py-1.5 text-right text-xs tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => { cambiarValorIndividual(producto, ''); alternarValorPropio(producto.id) }}
                        className="rounded p-1 text-text-dim hover:text-danger"
                        aria-label="Volver al valor general"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button" onClick={() => alternarValorPropio(producto.id)}
                      className="text-left text-[11px] text-text-dim hover:text-accent"
                    >
                      + % propio
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {data && data.count > POR_PAGINA && (
          <div className="mt-4">
            <Paginacion pagina={pagina} porPagina={POR_PAGINA} total={data.count} onCambiar={setPagina} />
          </div>
        )}
      </div>

      {/* 3 — Qué va a pasar y aplicar */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <p className="text-sm text-text">
            Se ajusta <span className="font-medium">{alcance}</span>
            {sinSeleccion && <span className="text-text-dim"> — no elegiste ninguno, así que va a toda la categoría.</span>}
          </p>
          {!sinSeleccion && impacto.antes > 0 && (
            <p className="text-xs text-text-dim">
              Suma de precios de lista <span className="tabular-nums">{formatMoney(impacto.antes)}</span> →{' '}
              <span className="tabular-nums text-text">{formatMoney(impacto.despues)}</span>
              <button
                type="button" onClick={() => setElegidos(new Map())}
                className="ml-3 inline-flex items-center gap-1 text-text-dim hover:text-danger"
              >
                <X size={11} /> vaciar selección
              </button>
            </p>
          )}
        </div>

        {/* El valor vive acá, pegado al botón que lo aplica y al texto que dice
            a cuántos productos les pega. Arriba, entre los filtros, se leía como
            un filtro más y no como "esto es lo que se va a aplicar". */}
        <div className="flex items-end gap-3">
          <InputDecimal
            id="valor"
            label={tipo === 'porcentaje' ? 'Porcentaje a aplicar' : 'Monto a aplicar'}
            placeholder={tipo === 'porcentaje' ? '-15' : '500'}
            value={valor} onChange={setValor}
            className="w-28 text-right text-base tabular-nums"
          />
          <Button
            type="button" onClick={() => setConfirmando(true)}
            disabled={aplicar.isPending || valor.trim() === ''}
          >
            {aplicar.isPending ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
            {sinSeleccion
              ? 'Aplicar a toda la categoría'
              : `Aplicar a los ${seleccionados.length} elegidos`}
          </Button>
        </div>
      </div>

      {confirmando && (
        <ConfirmDialog
          titulo="Aplicar ajuste de precios"
          descripcion={
            `Se va a cambiar el precio de venta de ${alcance}, `
            + `${tipo === 'porcentaje' ? `un ${valor || 0}%` : formatMoney(valor || 0)}`
            + `${seleccionados.some((s) => s.valorTexto.trim() !== '') ? ' (algunos con su propio valor)' : ''}. `
            + `No se puede deshacer, pero queda registrado en el historial.`
          }
          confirmarTexto="Aplicar ajuste" peligro
          cargando={aplicar.isPending}
          onConfirmar={aplicarAjuste}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
