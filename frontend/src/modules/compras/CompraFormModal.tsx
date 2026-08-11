import { useState, type FormEvent } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useProveedores } from '../proveedores/api'
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

export function CompraFormModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const { data: proveedores } = useProveedores({ activo: true })
  const createCompra = useCreateCompra()

  const [proveedor, setProveedor] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [pagado, setPagado] = useState(false)
  const [items, setItems] = useState<Row[]>([filaVacia()])

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
        pagado,
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

          <div className="grid grid-cols-[1fr_90px_120px_110px_28px] gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-dim">
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
                <div key={i} className="grid grid-cols-[1fr_90px_120px_110px_28px] items-center gap-2">
                  <ProductoPicker producto={row.producto} onSelect={(p) => elegirProducto(i, p)} />
                  <Input
                    aria-label="Cantidad" type="number" min="0.001" step="0.001" value={row.cantidad}
                    onChange={(e) => updateItem(i, { cantidad: e.target.value })}
                  />
                  <Input
                    aria-label="Costo unitario" type="number" min="0" step="0.01" value={row.costo_unitario}
                    onChange={(e) => updateItem(i, { costo_unitario: e.target.value })}
                  />
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

        <div className="flex items-center justify-between border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm text-text-dim">
            <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} />
            Ya está pagada
          </label>
          <span className="font-display text-lg font-semibold tabular-nums text-text">Total {formatMoney(total)}</span>
        </div>

        <p className="text-xs text-text-dim">
          El costo cargado queda como nuevo precio de costo de cada producto. Si está pagada y hay una caja
          abierta, se descuenta también del arqueo del turno.
        </p>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createCompra.isPending}>
            {createCompra.isPending && <Loader2 size={14} className="animate-spin" />}
            Registrar compra
          </Button>
        </div>
      </form>
    </Modal>
  )
}
