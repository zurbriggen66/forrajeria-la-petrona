import { Loader2 } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { useErrorLogs } from './api'
import type { ErrorLogEntry } from './types'

export function ErrorLogsPanel() {
  const { data: logs, isLoading } = useErrorLogs()

  const columns: Column<ErrorLogEntry>[] = [
    { header: 'Fecha', render: (l) => new Date(l.created_at).toLocaleString('es-AR') },
    { header: 'Tipo', render: (l) => l.tipo || '—' },
    { header: 'Módulo', render: (l) => l.modulo || '—' },
    { header: 'Usuario', render: (l) => l.user_nombre || '—' },
    { header: 'Mensaje', render: (l) => l.mensaje || '—', className: 'max-w-md truncate' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm font-semibold text-text">Errores recientes</h2>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando errores…
        </div>
      ) : (
        <Table columns={columns} rows={logs ?? []} rowKey={(l) => l.id} emptyMessage="Sin errores registrados en esta sucursal." />
      )}
    </div>
  )
}
