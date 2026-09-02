import { useState, type FormEvent } from 'react'
import { AlertTriangle, Layers, Loader2, Package, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { InputDecimal } from '../../components/ui/InputDecimal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney, parseDecimal } from '../../lib/format'
import { margenDesdePrecio, precioDesdeMargen, redondearCentavos } from '../../lib/margen'
import { ProductoPicker } from './ProductoPicker'
import { useCreateCombo, useUpdateCombo } from './api'
import type { Combo, Producto } from './types'

/** Un renglón del pack. `precioSuelto`, `costo` y `stock` se guardan acá y no
 * se leen del Producto porque al EDITAR un pack ya guardado no hay Producto
 * completo: el backend manda esos tres campos en cada ítem del combo. */
interface Row {
  productoId: string | null
  nombre: string
  cantidad: string
  precioSuelto: number
  costo: number
  stock: number
  unidad: string
}

function filaVacia(): Row {
  return { productoId: null, nombre: '', cantidad: '1', precioSuelto: 0, costo: 0, stock: 0, unidad: '' }
}

function filaDesdeCombo(item: Combo['items'][number]): Row {
  return {
    productoId: item.producto,
    nombre: item.producto_nombre ?? '',
    cantidad: item.cantidad,
    precioSuelto: parseDecimal(item.producto_precio_venta ?? '0'),
    costo: parseDecimal(item.producto_precio_costo ?? '0'),
    stock: parseDecimal(item.producto_stock ?? '0'),
    unidad: item.producto_unidad_medida ?? '',
  }
}

/** Cómo se define el precio del pack. Son tres formas de decir lo mismo y el
 * dueño piensa en una u otra según el caso: "100 mil los 10 balanceados"
 * (precio), "15% off llevando el pack" (descuento), "quiero 30 de margen"
 * (margen). Se elige una y las otras dos se muestran calculadas. */
type ModoPrecio = 'precio' | 'descuento' | 'margen'

const MODOS: { clave: ModoPrecio; label: string }[] = [
  { clave: 'precio', label: 'Precio del pack' },
  { clave: 'descuento', label: '% off del suelto' },
  { clave: 'margen', label: '% de margen' },
]

export function ComboFormModal({ combo, onClose }: { combo?: Combo; onClose: () => void }) {
  const { toast } = useToast()
  const createCombo = useCreateCombo()
  const updateCombo = useUpdateCombo()
  const esEdicion = Boolean(combo)

  const [nombre, setNombre] = useState(combo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(combo?.descripcion ?? '')
  const [precio, setPrecio] = useState(combo ? String(parseDecimal(combo.precio)) : '')
  const [modo, setModo] = useState<ModoPrecio>('precio')
  const [items, setItems] = useState<Row[]>(
    combo && combo.items.length > 0 ? combo.items.map(filaDesdeCombo) : [filaVacia()],
  )

  const guardando = createCombo.isPending || updateCombo.isPending

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function elegirProducto(index: number, producto: Producto | null) {
    if (!producto) {
      updateItem(index, filaVacia())
      return
    }
    updateItem(index, {
      productoId: producto.id,
      nombre: producto.nombre,
      precioSuelto: parseDecimal(producto.precio_venta),
      costo: parseDecimal(producto.precio_costo),
      stock: parseDecimal(producto.stock),
      unidad: producto.unidad_medida,
    })
  }

  const conProducto = items.filter((row) => row.productoId !== null)

  // Los tres números que hacen falta para saber si el pack sirve.
  const precioSuelto = conProducto.reduce((acc, r) => acc + r.precioSuelto * parseDecimal(r.cantidad), 0)
  const costo = conProducto.reduce((acc, r) => acc + r.costo * parseDecimal(r.cantidad), 0)
  const precioPack = parseDecimal(precio)

  const descuentoPct = precioSuelto > 0 ? ((precioSuelto - precioPack) / precioSuelto) * 100 : null
  const margenPct = margenDesdePrecio(costo, precioPack)
  // Manda el componente más escaso: con 8 balanceados no se arman dos packs de
  // 10 por más que sobren huevos.
  const armables = conProducto.length === 0
    ? 0
    : Math.min(...conProducto.map((r) => {
      const cantidad = parseDecimal(r.cantidad)
      return cantidad > 0 ? Math.floor(r.stock / cantidad) : 0
    }))

  const aPerdida = precioPack > 0 && precioPack < costo
  const masCaroQueSuelto = precioSuelto > 0 && precioPack > precioSuelto

  /** Las tres formas de fijar el precio escriben el mismo campo: `precio`. Así
   * no hay tres estados que puedan quedar en desacuerdo entre sí. */
  function fijarPorDescuento(pctTexto: string) {
    const pct = parseDecimal(pctTexto)
    setPrecio(String(redondearCentavos(precioSuelto * (1 - pct / 100))))
  }

  function fijarPorMargen(pctTexto: string) {
    const nuevo = precioDesdeMargen(costo, parseDecimal(pctTexto))
    if (nuevo !== null) setPrecio(String(redondearCentavos(nuevo)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (conProducto.length === 0) {
      toast('Agregá al menos un producto al pack', 'error')
      return
    }
    const sinCantidad = conProducto.findIndex((r) => parseDecimal(r.cantidad) <= 0)
    if (sinCantidad !== -1) {
      toast(`Poné cuántos "${conProducto[sinCantidad].nombre}" entran en el pack.`, 'error')
      return
    }
    const input = {
      nombre,
      descripcion,
      precio: String(redondearCentavos(precioPack)),
      items: conProducto.map((r) => ({ producto: r.productoId as string, cantidad: r.cantidad })),
    }
    try {
      if (combo) await updateCombo.mutateAsync({ id: combo.id, input })
      else await createCombo.mutateAsync(input)
      toast(esEdicion ? 'Pack actualizado' : 'Pack armado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el pack'), 'error')
    }
  }

  return (
    <Modal title={esEdicion ? `Editar ${combo?.nombre}` : 'Armar un pack'} onClose={onClose} ancho="xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            id="nombre" label="Nombre del pack" required autoFocus
            placeholder="Ej: 10 balanceados"
            value={nombre} onChange={(e) => setNombre(e.target.value)}
          />
          <Input
            id="descripcion" label="Descripción (opcional)"
            placeholder="Ej: promo del mes"
            value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Qué entra en el pack</span>
            <Button type="button" variant="ghost" onClick={() => setItems((p) => [...p, filaVacia()])} className="!px-2 !py-1 text-xs">
              <Plus size={13} /> Agregar producto
            </Button>
          </div>

          <div className="grid grid-cols-[1fr_130px_150px_160px_40px] gap-3 px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-text-dim">
            <span>Producto</span>
            <span>Cuántos entran</span>
            <span className="text-right">Suelto costaría</span>
            <span>Stock</span>
            <span />
          </div>

          <div className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto pr-1">
            {items.map((row, i) => {
              const cantidad = parseDecimal(row.cantidad)
              const sueltoLinea = row.precioSuelto * cantidad
              const alcanzaPara = cantidad > 0 ? Math.floor(row.stock / cantidad) : 0
              const esElCuelloDeBotella = row.productoId !== null && conProducto.length > 1 && alcanzaPara === armables
              return (
                <div key={i} className="grid grid-cols-[1fr_130px_150px_160px_40px] items-center gap-3 rounded-lg border border-border/60 bg-surface-2/40 p-2">
                  <ProductoPicker
                    producto={row.productoId ? { nombre: row.nombre } : null}
                    onSelect={(p) => elegirProducto(i, p)}
                  />

                  <InputDecimal
                    aria-label={`Cuántos ${row.nombre || 'productos'} entran en el pack`}
                    value={row.cantidad}
                    onChange={(valor) => updateItem(i, { cantidad: valor })}
                    className="!py-2 text-right text-base tabular-nums"
                  />

                  <span className="text-right tabular-nums text-text-dim">
                    {row.productoId ? formatMoney(sueltoLinea) : '—'}
                  </span>

                  <span className="text-xs text-text-dim">
                    {row.productoId ? (
                      <>
                        {Math.round(row.stock * 1000) / 1000} {row.unidad} ·{' '}
                        <span className={esElCuelloDeBotella ? 'text-warning' : 'text-text'}>
                          alcanza para {alcanzaPara}
                        </span>
                      </>
                    ) : '—'}
                  </span>

                  <button
                    type="button" onClick={() => setItems((p) => (p.length === 1 ? p : p.filter((_, j) => j !== i)))}
                    disabled={items.length === 1}
                    className="rounded-md p-2 text-text-dim hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                    aria-label="Quitar del pack"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Precio: tres formas de decir lo mismo, todas escriben el mismo campo. */}
        <div className="rounded-xl border border-border bg-surface-2/40 p-4">
          <div className="mb-3 flex gap-1 rounded-lg bg-surface-2 p-1">
            {MODOS.map((m) => (
              <button
                key={m.clave} type="button" onClick={() => setModo(m.clave)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  modo === m.clave ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            {modo === 'precio' && (
              <InputDecimal
                id="precio" label="Precio del pack" placeholder="100000"
                value={precio} onChange={setPrecio}
                className="text-right text-base tabular-nums"
              />
            )}
            {modo === 'descuento' && (
              <InputDecimal
                id="descuento" label="% off sobre el suelto" placeholder="15"
                value={descuentoPct === null ? '' : String(Math.round(descuentoPct * 10) / 10)}
                onChange={fijarPorDescuento}
                className="text-right text-base tabular-nums"
              />
            )}
            {modo === 'margen' && (
              <InputDecimal
                id="margen" label="% de margen del pack" placeholder="30"
                value={margenPct === null ? '' : String(Math.round(margenPct * 10) / 10)}
                onChange={fijarPorMargen}
                className="text-right text-base tabular-nums"
              />
            )}

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-dim">Suelto costaría</p>
                <p className="tabular-nums text-text">{formatMoney(precioSuelto)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-dim">Precio del pack</p>
                <p className="font-display font-semibold tabular-nums text-text">{formatMoney(precioPack)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-dim">Le regalás</p>
                <p className={`tabular-nums ${masCaroQueSuelto ? 'text-danger' : 'text-accent-2'}`}>
                  {descuentoPct === null ? '—' : `${descuentoPct.toFixed(1)}%`}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-dim">Margen del pack</p>
                <p className={`tabular-nums ${aPerdida ? 'text-danger' : 'text-text'}`}>
                  {margenPct === null ? '—' : `${margenPct.toFixed(1)}%`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
            <span className="flex items-center gap-1.5 text-text-dim">
              <Layers size={13} />
              Con el stock de hoy armás <span className="tabular-nums text-text">{armables}</span> pack{armables === 1 ? '' : 's'}
            </span>
            {conProducto.length > 0 && parseDecimal(conProducto[0].cantidad) > 0 && conProducto.length === 1 && (
              <span className="flex items-center gap-1.5 text-text-dim">
                <Package size={13} />
                Sale <span className="tabular-nums text-text">
                  {formatMoney(precioPack / parseDecimal(conProducto[0].cantidad))}
                </span> cada uno
                <span className="text-text-dim">(suelto {formatMoney(conProducto[0].precioSuelto)})</span>
              </span>
            )}
            {aPerdida && (
              <span className="flex items-center gap-1.5 text-danger">
                <AlertTriangle size={13} /> El pack sale menos de lo que te cuesta
              </span>
            )}
            {masCaroQueSuelto && (
              <span className="flex items-center gap-1.5 text-danger">
                <AlertTriangle size={13} /> El pack sale más caro que comprarlo suelto
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-text-dim">
            Un pack es una receta, no mercadería aparte: no reserva stock al armarlo.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 size={14} className="animate-spin" />}
              {esEdicion ? 'Guardar cambios' : 'Armar pack'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
