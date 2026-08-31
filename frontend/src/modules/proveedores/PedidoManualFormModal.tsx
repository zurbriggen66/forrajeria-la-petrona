import { useState, type FormEvent } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useCrearPedidoManual } from './api'

interface Row {
  producto: Producto | null
  cantidad: string
}

export function PedidoManualFormModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const crearPedido = useCrearPedidoManual()
  const [rows, setRows] = useState<Row[]>([{ producto: null, cantidad: '1' }])

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((prev) => [...prev, { producto: null, cantidad: '1' }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validas = rows.filter((r) => r.producto)
    if (validas.length === 0) {
      toast('Agregá al menos un producto', 'error')
      return
    }
    const detalle = validas.map((r) => ({
      producto: r.producto!.id,
      nombre: r.producto!.nombre,
      cantidad: r.cantidad,
      proveedor: r.producto!.proveedor,
      proveedor_nombre: r.producto!.proveedor_nombre,
    }))
    try {
      await crearPedido.mutateAsync(detalle)
      toast('Pedido creado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo crear el pedido'), 'error')
    }
  }

  return (
    <Modal title="Nuevo pedido" onClose={onClose} ancho="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Productos a pedir</span>
            <Button type="button" variant="ghost" onClick={addRow} className="!px-2 !py-1 text-xs">
              <Plus size={13} /> Agregar
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <ProductoPicker producto={row.producto} onSelect={(p) => updateRow(i, { producto: p })} />
                </div>
                <Input
                  type="number" min="0.001" step="any" value={row.cantidad}
                  onChange={(e) => updateRow(i, { cantidad: e.target.value })}
                  className="w-24" aria-label="Cantidad"
                />
                <button type="button" onClick={() => removeRow(i)} className="mt-2 rounded p-1 text-text-dim hover:bg-danger/10 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={crearPedido.isPending}>
            {crearPedido.isPending && <Loader2 size={14} className="animate-spin" />}
            Crear pedido
          </Button>
        </div>
      </form>
    </Modal>
  )
}
