import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useActualizarEstadoPedido, usePedidosManuales } from './api'
import { PedidoManualFormModal } from './PedidoManualFormModal'
import type { PedidoManual } from './types'

const ESTADOS: { value: string; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'recibido', label: 'Recibido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const COLOR_ESTADO: Record<string, string> = {
  pendiente: 'text-warning',
  enviado: 'text-accent',
  recibido: 'text-accent-2',
  cancelado: 'text-danger',
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function PedidoCard({ pedido }: { pedido: PedidoManual }) {
  const { toast } = useToast()
  const actualizarEstado = useActualizarEstadoPedido()

  async function handleEstado(estado: string) {
    try {
      await actualizarEstado.mutateAsync({ id: pedido.id, estado })
      toast('Estado actualizado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo actualizar el estado'), 'error')
    }
  }

  return (
    <div className="tarjeta-viva rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-text-dim">{formatFecha(pedido.created_at)}</span>
        <Select
          value={pedido.estado} onChange={(e) => handleEstado(e.target.value)}
          disabled={actualizarEstado.isPending} className={`!py-1 text-xs font-medium ${COLOR_ESTADO[pedido.estado] ?? ''}`}
        >
          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </Select>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {(pedido.detalle ?? []).map((item, i) => (
          <li key={i} className="flex justify-between">
            <span>{item.cantidad}× {item.nombre}</span>
            <span className="text-text-dim">{item.proveedor_nombre ?? 'Sin proveedor'}</span>
          </li>
        ))}
        {(pedido.detalle ?? []).length === 0 && <li className="text-text-dim">Sin ítems.</li>}
      </ul>
    </div>
  )
}

export function PedidosManuales() {
  const { data: pedidos, isLoading } = usePedidosManuales()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-dim">
          Pedidos armados a mano o generados desde "Sugeridos". Cambiá el estado a medida que avanzan
          (pendiente → enviado → recibido).
        </p>
        <Button onClick={() => setShowForm(true)} className="shrink-0"><Plus size={15} /> Nuevo pedido</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando pedidos…
        </div>
      ) : (pedidos ?? []).length === 0 ? (
        <p className="py-16 text-center text-text-dim">
          Todavía no armaste ningún pedido. Creá uno con "Nuevo pedido" o elegí productos en "Sugeridos".
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pedidos!.map((p) => <PedidoCard key={p.id} pedido={p} />)}
        </div>
      )}

      {showForm && <PedidoManualFormModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
