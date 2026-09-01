import { useState, type FormEvent } from 'react'
import { History, Loader2, Plus, Sparkles, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { InputDecimal } from '../../components/ui/InputDecimal'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatFechaSola, formatMoney, parseDecimal, redondearCantidad } from '../../lib/format'
import { ProductoFormModal } from '../productos/ProductoFormModal'
import { ProductoPicker } from '../productos/ProductoPicker'
import { aUnidadDeMedida, contenidoEnvase, presentacionDe } from '../productos/presentacion'
import type { Producto } from '../productos/types'
import { useProveedores } from '../proveedores/api'
import { useCuentasPago } from '../caja/api'
import { useCreateCompra, useUltimaCompraProducto } from './api'
import { PrecioVentaModal, type LineaComprada } from './PrecioVentaModal'

/** Cómo viene escrita la factura del proveedor. Es una sola para toda la compra
 * y no por renglón: un remito lista todo con el total de la línea, o todo con
 * el precio por unidad — no mezcla. */
type ModoPrecio = 'total' | 'unitario'

interface Row {
  producto: Producto | null
  /** Lo que se tipea en el campo de cantidad. Puede estar en envases cerrados
   * (bolsas, rollos, cajas) o en unidades sueltas — lo dice `enEnvase`. La
   * cantidad que viaja al backend SIEMPRE está en unidad_medida, porque así
   * guarda el stock (ver productos/models.py). */
  cantidadTexto: string
  /** El campo de cantidad está en envases cerrados y no en unidades sueltas. */
  enEnvase: boolean
  /** Costo por unidad_medida, que es lo que espera el backend. Cuatro
   * decimales, como Producto.precio_costo y CompraItem.costo_unitario. */
  costo_unitario: string
  /** Lo tipeado en modo "total de la línea". Se guarda aparte y NO se deriva de
   * costo_unitario en cada render: si se derivara, cada tecla redondearía y
   * reescribiría el campo con el total recalculado, y no se podía tipear. */
  totalTexto: string
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function filaVacia(): Row {
  return { producto: null, cantidadTexto: '1', enEnvase: false, costo_unitario: '0', totalTexto: '' }
}

function aTextoTotal(total: number) {
  return total > 0 ? String(Math.round(total * 100) / 100) : ''
}

/** Cuánto entra al stock por esta fila, en unidad_medida.
 *
 * Es la traducción que antes tenía que hacer a mano el dueño: la factura dice
 * "50 bolsas" y el sistema necesita 1.250 kg. Cargar bolsas y que se guarden
 * como si fueran kilos metía 50 kg en el stock en vez de 1.250. */
function cantidadEnUnidad(row: Row): number {
  return aUnidadDeMedida(
    parseDecimal(row.cantidadTexto),
    row.enEnvase,
    row.producto ? contenidoEnvase(row.producto) : null,
  )
}

/** A cuánto se compró la última vez: cuándo, cuánto la unidad y cuántas.
 *
 * Es la pregunta que se hace el dueño con el remito en la mano — "¿me
 * aumentaron?". Producto.precio_costo guarda el último costo, pero sin la fecha
 * ni la cantidad no dice nada: puede ser de ayer o del año pasado. */
function UltimaCompra({ productoId, costoAhora, unidad }: { productoId: string; costoAhora: number; unidad: string }) {
  const { data, isLoading } = useUltimaCompraProducto(productoId)

  if (isLoading) {
    return (
      <p className="mt-1 flex items-center gap-1 text-xs text-text-dim">
        <Loader2 size={11} className="animate-spin" /> Buscando la última compra…
      </p>
    )
  }
  if (!data) {
    return <p className="mt-1 text-xs text-text-dim">Primera compra de este producto.</p>
  }

  const antes = parseDecimal(data.costo_unitario)
  const variacion = antes > 0 && costoAhora > 0 ? ((costoAhora - antes) / antes) * 100 : null
  const subio = (variacion ?? 0) > 0
  const Icono = subio ? TrendingUp : TrendingDown

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-text-dim">
      <History size={11} className="shrink-0" />
      Última compra {formatFechaSola(data.fecha)}:
      <span className="tabular-nums text-text">{formatMoney(antes)}/{unidad}</span>
      <span>· {Number(data.cantidad)} {unidad}</span>
      {data.proveedor_nombre && <span className="truncate">· {data.proveedor_nombre}</span>}
      {/* Menos de medio punto es ruido de redondeo, no un aumento. */}
      {variacion !== null && Math.abs(variacion) >= 0.5 && (
        <span
          className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums ${
            subio ? 'bg-warning/15 text-warning' : 'bg-accent-2/15 text-accent-2'
          }`}
        >
          <Icono size={10} />
          {subio ? '+' : ''}{variacion.toFixed(0)}%
        </span>
      )}
    </p>
  )
}

export function CompraFormModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const { data: proveedores } = useProveedores({ activo: true })
  const { data: cuentas } = useCuentasPago(true)
  const createCompra = useCreateCompra()

  const [proveedor, setProveedor] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [pagado, setPagado] = useState(false)
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [cuentaPago, setCuentaPago] = useState('')
  // Arranca en "total de la línea": es lo que trae el remito del proveedor. El
  // costo por unidad hay que dividirlo a mano, y de eso se encarga esto.
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>('total')
  const [items, setItems] = useState<Row[]>([filaVacia()])
  // Índice de la fila para la que se está creando un producto nuevo (por si
  // llegó algo que todavía no está en el catálogo). null = cerrado.
  const [creandoProductoEn, setCreandoProductoEn] = useState<number | null>(null)
  // Segundo paso: qué se acaba de comprar, para ponerle precio de venta. Guarda
  // el Producto tal como estaba ANTES de la compra (precios y margen viejos),
  // que es contra lo que hay que comparar el costo nuevo.
  const [aPrecificar, setAPrecificar] = useState<LineaComprada[] | null>(null)

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  /** Los tres números de una fila están atados: total = costo por unidad ×
   * cantidad (en unidad_medida). Se toca uno y se recalcula el que
   * corresponde, nunca los dos. */
  function recalcularDesdeTotal(row: Row, totalTexto: string): Partial<Row> {
    const cantidad = cantidadEnUnidad({ ...row, cantidadTexto: row.cantidadTexto })
    const costo = cantidad > 0 ? parseDecimal(totalTexto) / cantidad : 0
    return { totalTexto, costo_unitario: costo.toFixed(4) }
  }

  function cambiarTotal(index: number, valor: string) {
    updateItem(index, recalcularDesdeTotal(items[index], valor))
  }

  function cambiarCostoUnitario(index: number, valor: string) {
    const total = parseDecimal(valor) * cantidadEnUnidad(items[index])
    updateItem(index, { costo_unitario: valor, totalTexto: aTextoTotal(total) })
  }

  function cambiarCantidad(index: number, valor: string) {
    const row = { ...items[index], cantidadTexto: valor }
    if (modoPrecio === 'unitario') {
      // El costo por unidad lo fijó el usuario: manda él y se recalcula el total.
      const total = parseDecimal(row.costo_unitario) * cantidadEnUnidad(row)
      updateItem(index, { cantidadTexto: valor, totalTexto: aTextoTotal(total) })
      return
    }
    // En modo total, lo que fijó el usuario es lo que pagó: corregir "50" a
    // "55" tiene que mantener el total y bajar el costo por unidad.
    const cantidad = cantidadEnUnidad(row)
    const costo = cantidad > 0 ? parseDecimal(row.totalTexto) / cantidad : 0
    updateItem(index, { cantidadTexto: valor, costo_unitario: costo.toFixed(4) })
  }

  /** Cambiar entre cargar por envase cerrado o por unidad suelta. Lo tipeado se
   * mantiene ("50" sigue siendo 50) y lo que cambia es qué significa, así que
   * el costo por unidad se recalcula contra la cantidad nueva. */
  function cambiarUnidadDeCarga(index: number, enEnvase: boolean) {
    const row = { ...items[index], enEnvase }
    if (modoPrecio === 'total') {
      const cantidad = cantidadEnUnidad(row)
      const costo = cantidad > 0 ? parseDecimal(row.totalTexto) / cantidad : 0
      updateItem(index, { enEnvase, costo_unitario: costo.toFixed(4) })
      return
    }
    updateItem(index, { enEnvase, totalTexto: aTextoTotal(parseDecimal(row.costo_unitario) * cantidadEnUnidad(row)) })
  }

  function elegirProducto(index: number, producto: Producto | null) {
    // Precarga el último costo conocido: ahorra tipear en la mayoría de los
    // casos, y el usuario lo corrige si esta vez cambió.
    //
    // `stock_en_bolsas` ya es la preferencia del dueño para ESTE producto —
    // cómo prefiere pensarlo y cargarlo. Si ahí eligió bolsas, la compra
    // arranca en bolsas: no hay razón para preguntárselo dos veces.
    const costo = producto ? producto.precio_costo : '0'
    const enEnvase = Boolean(producto && producto.stock_en_bolsas && contenidoEnvase(producto))
    const row: Row = { ...items[index], producto, enEnvase, costo_unitario: costo }
    updateItem(index, { producto, enEnvase, costo_unitario: costo, totalTexto: aTextoTotal(parseDecimal(costo) * cantidadEnUnidad(row)) })
  }

  function addRow() {
    setItems((prev) => [...prev, filaVacia()])
  }

  function removeRow(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const total = items.reduce((acc, row) => acc + cantidadEnUnidad(row) * parseDecimal(row.costo_unitario), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validItems = items.filter((i): i is Row & { producto: Producto } => i.producto !== null)
    if (validItems.length === 0) {
      toast('Agregá al menos un producto', 'error')
      return
    }
    // Se avisa acá y no después del viaje al servidor: es el rechazo más común
    // y el número de fila lo sabemos sin preguntarle a nadie.
    const sinCantidad = validItems.findIndex((i) => cantidadEnUnidad(i) <= 0)
    if (sinCantidad !== -1) {
      toast(`Fila ${sinCantidad + 1}: poné cuánto compraste de "${validItems[sinCantidad].producto.nombre}".`, 'error')
      return
    }
    try {
      await createCompra.mutateAsync({
        proveedor: proveedor || null,
        numero_factura: numeroFactura,
        fecha,
        fecha_vencimiento: pagado ? null : fechaVencimiento || null,
        pagado,
        cuenta_pago: pagado ? cuentaPago || null : null,
        items: validItems.map((row) => ({
          producto: row.producto.id,
          // Siempre en unidad_medida: el backend suma esto al stock tal cual.
          // Redondeado porque sale de multiplicar bolsas × contenido, y en
          // JavaScript eso deja colas de decimales que el backend rechaza.
          cantidad: redondearCantidad(cantidadEnUnidad(row)),
          costo_unitario: row.costo_unitario || '0',
        })),
      })
      // Dos renglones del mismo producto entran en la misma compra y el costo
      // que le queda al producto es el del último: se muestra una sola fila.
      const porProducto = new Map<string, LineaComprada>()
      for (const row of validItems) {
        porProducto.set(row.producto.id, {
          producto: row.producto,
          costoNuevo: parseDecimal(row.costo_unitario),
        })
      }
      setAPrecificar([...porProducto.values()])
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo registrar la compra'), 'error')
    }
  }

  const enTotal = modoPrecio === 'total'

  // La compra ya está registrada: se reemplaza el formulario por el paso de
  // precios en vez de apilar dos modales, así no quedan datos viejos detrás.
  if (aPrecificar) {
    return <PrecioVentaModal lineas={aPrecificar} onClose={onClose} />
  }

  return (
    <Modal title="Nueva compra" onClose={onClose} ancho="xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-4">
          <Select id="proveedor" label="Proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
            <option value="">Sin proveedor</option>
            {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
          <Input id="numero-factura" label="N° de factura" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} />
          <Input id="fecha" label="Fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Productos comprados</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-dim">La factura dice</span>
                <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
                  <button
                    type="button" onClick={() => setModoPrecio('total')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      enTotal ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Total por línea
                  </button>
                  <button
                    type="button" onClick={() => setModoPrecio('unitario')}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      !enTotal ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Precio unitario
                  </button>
                </div>
              </div>
              <Button type="button" variant="ghost" onClick={addRow} className="!px-2 !py-1 text-xs">
                <Plus size={13} /> Agregar producto
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_150px_190px_150px_40px] gap-3 px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-text-dim">
            <span>Producto</span>
            <span>{enTotal ? 'Total de la línea' : 'Precio unitario'}</span>
            <span>Cantidad</span>
            <span className="text-right">{enTotal ? 'Costo unitario' : 'Total de la línea'}</span>
            <span />
          </div>
          {/* Scroll propio: con quince renglones, el total y el botón de guardar
              tienen que seguir a la vista sin recorrer toda la página. */}
          <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto pr-1">
            {items.map((row, i) => {
              const costoUnitario = parseDecimal(row.costo_unitario)
              const cantidad = cantidadEnUnidad(row)
              const subtotal = cantidad * costoUnitario
              const envase = row.producto ? contenidoEnvase(row.producto) : null
              const unidad = row.producto?.unidad_medida || 'unidad'
              const { envasePlural } = presentacionDe(unidad)
              return (
                <div key={i} className="grid grid-cols-[1fr_150px_190px_150px_40px] items-start gap-3 rounded-lg border border-border/60 bg-surface-2/40 p-2">
                  <div className="min-w-0">
                    <ProductoPicker producto={row.producto} onSelect={(p) => elegirProducto(i, p)} />
                    {row.producto ? (
                      <UltimaCompra productoId={row.producto.id} costoAhora={costoUnitario} unidad={unidad} />
                    ) : (
                      <button
                        type="button" onClick={() => setCreandoProductoEn(i)}
                        className="mt-1 flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <Sparkles size={12} /> No está en el catálogo — crear producto nuevo
                      </button>
                    )}
                  </div>

                  <InputDecimal
                    aria-label={enTotal ? 'Total de la línea según la factura' : 'Precio unitario'}
                    placeholder="0"
                    value={enTotal ? row.totalTexto : row.costo_unitario}
                    onChange={(valor) => (enTotal ? cambiarTotal(i, valor) : cambiarCostoUnitario(i, valor))}
                    className="!py-2.5 text-right text-base tabular-nums"
                  />

                  <div>
                    <InputDecimal
                      aria-label="Cantidad"
                      value={row.cantidadTexto}
                      onChange={(valor) => cambiarCantidad(i, valor)}
                      className="!py-2.5 text-right text-base tabular-nums"
                    />
                    {/* El producto se vende suelto Y por envase cerrado: la
                        factura del proveedor viene en bolsas y el stock en kg,
                        así que la conversión la hace el sistema. */}
                    {envase ? (
                      <>
                        <div className="mt-1 flex gap-1 rounded-lg bg-surface-2 p-0.5">
                          <button
                            type="button" onClick={() => cambiarUnidadDeCarga(i, true)}
                            className={`flex-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                              row.enEnvase ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                            }`}
                          >
                            {envasePlural}
                          </button>
                          <button
                            type="button" onClick={() => cambiarUnidadDeCarga(i, false)}
                            className={`flex-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                              !row.enEnvase ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                            }`}
                          >
                            {unidad}
                          </button>
                        </div>
                        {row.enEnvase && (
                          <p className="mt-1 text-xs tabular-nums text-text-dim">
                            = {Math.round(cantidad * 1000) / 1000} {unidad} al stock
                          </p>
                        )}
                      </>
                    ) : (
                      row.producto && <p className="mt-1 text-xs text-text-dim">{unidad}</p>
                    )}
                  </div>

                  {/* Lo que calcula el sistema: en modo total es el costo por
                      unidad, que es justamente lo que el dueño quiere saber. */}
                  <div className="pt-2 text-right">
                    <p className="tabular-nums text-text">
                      {formatMoney(enTotal ? costoUnitario : subtotal)}
                      {enTotal && <span className="text-xs text-text-dim">/{unidad}</span>}
                    </p>
                    <p className="text-xs text-text-dim">
                      {enTotal ? `Línea ${formatMoney(subtotal)}` : 'calculado'}
                    </p>
                  </div>

                  <button
                    type="button" onClick={() => removeRow(i)} disabled={items.length === 1}
                    className="mt-1.5 rounded p-2 text-text-dim hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                    aria-label="Quitar fila"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
              <button
                type="button" onClick={() => setPagado(true)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pagado ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                }`}
              >
                Pagada ahora
              </button>
              <button
                type="button" onClick={() => setPagado(false)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  !pagado ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
                }`}
              >
                Fiada (pago después)
              </button>
            </div>
            <span className="font-display text-lg font-semibold tabular-nums text-text">Total {formatMoney(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {pagado ? (
              <Select id="cuenta-pago" label="Pagado desde" value={cuentaPago} onChange={(e) => setCuentaPago(e.target.value)}>
                <option value="">Efectivo (por defecto)</option>
                {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            ) : (
              <Input
                id="fecha-vencimiento" label="Vence el (opcional)" type="date"
                value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            )}
          </div>
        </div>

        <p className="text-xs text-text-dim">
          {pagado
            ? 'El costo cargado queda como nuevo precio de costo de cada producto. Con la caja abierta, el pago se descuenta del arqueo del turno. Al guardar te pregunto a cuánto lo vendés.'
            : 'La mercadería entra al stock hoy y la deuda va a la cuenta corriente del proveedor, pero no sale plata de la caja. Después registrás el pago desde el listado — el gasto va a contar el día que pagues, no hoy.'}
        </p>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createCompra.isPending}>
            {createCompra.isPending && <Loader2 size={14} className="animate-spin" />}
            Registrar y poner precios
          </Button>
        </div>
      </form>

      {creandoProductoEn !== null && (
        <ProductoFormModal
          onClose={() => setCreandoProductoEn(null)}
          onCreated={(producto) => elegirProducto(creandoProductoEn, producto)}
        />
      )}
    </Modal>
  )
}
