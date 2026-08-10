import { useState } from 'react'
import { Loader2, Receipt } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { TicketDetalleModal } from './TicketDetalleModal'
import { useVentas } from './api'
import type { Venta } from './types'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function Tickets() {
  const [numero, setNumero] = useState('')
  const [seleccionada, setSeleccionada] = useState<Venta | null>(null)
  const { data, isLoading } = useVentas(numero ? { numero_ticket: numero } : {})

  const columns: Column<Venta>[] = [
    { header: 'Ticket', render: (v) => `#${v.numero_ticket ?? '—'}` },
    { header: 'Fecha', render: (v) => formatFecha(v.created_at) },
    { header: 'Cliente', render: (v) => v.cliente_nombre ?? 'Consumidor final' },
    { header: 'Total', render: (v) => formatMoney(v.total), className: 'tabular-nums' },
    {
      header: 'Estado',
      render: (v) => (v.anulada ? <span className="text-danger">Anulada</span> : <span className="text-accent-2">Activa</span>),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm text-text-dim">
        <Receipt size={15} className="text-accent" /> Buscá un ticket por número para volver a verlo o reimprimirlo.
      </p>

      <div className="max-w-xs">
        <Input
          id="buscar-ticket" label="Número de ticket" type="number" min="1"
          placeholder="Ej: 1024" value={numero} onChange={(e) => setNumero(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={data?.results ?? []}
          rowKey={(v) => v.id}
          emptyMessage={numero ? 'No se encontró ese ticket.' : 'Últimos tickets.'}
          onRowClick={setSeleccionada}
        />
      )}

      {seleccionada && <TicketDetalleModal venta={seleccionada} onClose={() => setSeleccionada(null)} />}
    </div>
  )
}
