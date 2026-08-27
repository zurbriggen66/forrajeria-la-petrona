import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { ProductoFormModal } from '../productos/ProductoFormModal'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useProveedores } from '../proveedores/api'
import { useCuentasPago } from '../caja/api'
import { useCreateCompra } from './api'

interface Row {
  producto: Producto | null
  cantidad: string
  costo_unitario: string
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function filaVacia(): Row {
  return { producto: null, cantidad: '1', costo_unitario: '0' }
}

/** Costo unitario, tipeado directo o derivado de "pagué $X por Y unidades"
 * — muy habitual en la compra real (la factura del proveedor trae el total
 * de la línea, no el precio por bolsa). El total tipeado se guarda en un
 * buffer local y NO se deriva de costo_unitario en cada render: si se
 * derivara, cada tecla redondeaba el costo a 4 decimales y reescribía el
 * campo con ese total recalculado — mismo problema que CantidadPorPeso en
 * el carrito del POS, misma solución. */
function CostoUnitarioInput({ row, onChange }: { row: Row; onChange: (costo_unitario: string) => void }) {
  const [modo, setModo] = useState<'unitario' | 'total'>('unitario')
  const [totalTexto, setTotalTexto] = useState('')

  // onChange cambia de identidad en cada render del padre; por referencia, el
  // efecto de abajo depende sólo de lo que de verdad recalcula el costo.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // En modo "pagué en total" el costo unitario se recalcula solo cuando
  // cambia la cantidad: cargar "$110.000" y después corregir "50" a "55"
  // tiene que mantener el total pagado, no dejar el costo unitario clavado
  // en el de antes (mismo criterio que MontoOPorcentaje en el POS).
  useEffect(() => {
    if (modo !== 'total') return
    const cantidad = Number(row.cantidad) || 0
    const costo = cantidad > 0 ? (Number(totalTexto) || 0) / cantidad : 0
    onChangeRef.current(costo.toFixed(4))
  }, [modo, totalTexto, row.cantidad])

  function activarModoTotal() {
    const total = Number(row.cantidad || 0) * Number(row.costo_unitario || 0)
    setTotalTexto(total > 0 ? String(Math.round(total * 100) / 100) : '')
    setModo('total')
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          aria-label={modo === 'unitario' ? 'Costo unitario' : 'Total pagado por esta línea'}
          type="number" min="0" step={modo === 'unitario' ? '0.01' : 'any'} placeholder="0"
          onFocus={(e) => e.target.select()}
          value={modo === 'unitario' ? row.costo_unitario : totalTexto}
          onChange={(e) => (
            modo === 'unitario' ? onChange(e.target.value) : setTotalTexto(e.target.value)
          )}
          className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm tabular-nums focus:border-accent focus:outline-none"
        />
      </div>
      <div className="flex gap-1">
        <button
          type="button" onClick={() => setModo('unitario')}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
            modo === 'unitario' ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
          }`}
        >
          Unitario
        </button>
        <button
          type="button" onClick={activarModoTotal}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
            modo === 'total' ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
          }`}
        >
          Pagué en total
        </button>
      </div>
    </div>
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
  const [items, setItems] = useState<Row[]>([filaVacia()])
  // Índice de la fila para la que se está creando un producto nuevo (por si
  // llegó algo que todavía no está en el catálogo). null = cerrado.
  const [creandoProductoEn, setCreandoProductoEn] = useState<number | null>(null)

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function elegirProducto(index: number, producto: Producto | null) {
    // Precarga el último costo conocido del producto: ahorra tipear en la
    // mayoría de los casos (el usuario lo corrige si esta vez cambió).
    updateItem(index, {
      producto,
      costo_unitario: producto ? producto.precio_costo : '0',
    })
  }

  function addRow() {
    setItems((prev) => [...prev, filaVacia()])
  }

  function removeRow(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const total = items.reduce((acc, i) => acc + Number(i.cantidad || 0) * Number(i.costo_unitario || 0), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validItems = items.filter((i): i is Row & { producto: Producto } => i.producto !== null)
    if (validItems.length === 0) {
      toast('Agregá al menos un producto', 'error')
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
        items: validItems.map((i) => ({ producto: i.producto.id, cantidad: i.cantidad, costo_unitario: i.costo_unitario })),
      })
      toast('Compra registrada')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo registrar la compra'), 'error')
    }
  }

  return (
    <Modal title="Nueva compra" onClose={onClose} wide>
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
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Productos comprados</span>
            <Button type="button" variant="ghost" onClick={addRow} className="!px-2 !py-1 text-xs">
              <Plus size={13} /> Agregar producto
            </Button>
          </div>

          <div className="grid grid-cols-[1fr_90px_150px_110px_28px] gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-dim">
            <span>Producto</span>
            <span>Cantidad</span>
            <span>Costo unitario</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>
          <div className="flex flex-col gap-2">
            {items.map((row, i) => {
              const subtotal = Number(row.cantidad || 0) * Number(row.costo_unitario || 0)
              return (
                <div key={i} className="grid grid-cols-[1fr_90px_150px_110px_28px] items-center gap-2">
                  <div>
                    <ProductoPicker producto={row.producto} onSelect={(p) => elegirProducto(i, p)} />
                    {!row.producto && (
                      <button
                        type="button" onClick={() => setCreandoProductoEn(i)}
                        className="mt-1 flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <Sparkles size={12} /> No está en el catálogo — crear producto nuevo
                      </button>
                    )}
                  </div>
                  <Input
                    aria-label="Cantidad" type="number" min="0.001" step="any" value={row.cantidad}
                    onChange={(e) => updateItem(i, { cantidad: e.target.value })}
                  />
                  <CostoUnitarioInput row={row} onChange={(costo_unitario) => updateItem(i, { costo_unitario })} />
                  <span className="text-right text-sm tabular-nums text-text-dim">{formatMoney(subtotal)}</span>
                  <button
                    type="button" onClick={() => removeRow(i)} disabled={items.length === 1}
                    className="rounded p-2 text-text-dim hover:bg-danger/10 hover:text-danger disabled:opacity-30"
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
            ? 'El costo cargado queda como nuevo precio de costo de cada producto. Con la caja abierta, el pago se descuenta del arqueo del turno.'
            : 'La mercadería entra al stock hoy y la deuda va a la cuenta corriente del proveedor, pero no sale plata de la caja. Después registrás el pago desde el listado — el gasto va a contar el día que pagues, no hoy.'}
        </p>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createCompra.isPending}>
            {createCompra.isPending && <Loader2 size={14} className="animate-spin" />}
            Registrar compra
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
