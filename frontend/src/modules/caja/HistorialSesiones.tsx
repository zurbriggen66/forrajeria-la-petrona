import { Loader2 } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { useSesiones } from './api'
import type { CajaSesion } from './types'

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function HistorialSesiones() {
  const { data: sesiones, isLoading } = useSesiones()

  const columns: Column<CajaSesion>[] = [
    { header: 'Cajero', render: (s) => s.cajero_nombre ?? '—' },
    { header: 'Apertura', render: (s) => formatFecha(s.fecha_apertura) },
    { header: 'Cierre', render: (s) => formatFecha(s.fecha_cierre) },
    { header: 'Inicial', render: (s) => formatMoney(s.monto_apertura), className: 'tabular-nums' },
    { header: 'Esperado', render: (s) => (s.monto_esperado === null ? '—' : formatMoney(s.monto_esperado)), className: 'tabular-nums' },
    { header: 'Contado', render: (s) => (s.monto_cierre === null ? '—' : formatMoney(s.monto_cierre)), className: 'tabular-nums' },
    {
      header: 'Diferencia',
      className: 'tabular-nums',
      render: (s) => {
        if (s.diferencia === null) return '—'
        const dif = Number(s.diferencia)
        return <span className={dif === 0 ? 'text-accent-2' : dif > 0 ? 'text-warning' : 'text-danger'}>{formatMoney(dif)}</span>
      },
    },
    {
      header: 'Estado',
      render: (s) => (
        <span className={s.estado === 'abierta' ? 'text-accent-2' : 'text-text-dim'}>
          {s.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-dim">Historial de aperturas y cierres de caja, con su arqueo.</p>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando historial…
        </div>
      ) : (
        <Table columns={columns} rows={sesiones ?? []} rowKey={(s) => s.id} emptyMessage="Todavía no hay sesiones de caja registradas." />
      )}
    </div>
  )
}
