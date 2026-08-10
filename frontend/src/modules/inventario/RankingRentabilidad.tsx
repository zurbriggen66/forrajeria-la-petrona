import { AlertTriangle, Loader2 } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney, formatPct } from '../../lib/format'
import { useRankingRentabilidad, type RankingItem } from './api'

export function RankingRentabilidad() {
  const { data, isLoading, isError } = useRankingRentabilidad()

  const columns: Column<RankingItem>[] = [
    { header: 'Producto', render: (r) => r.nombre },
    { header: 'Categoría', render: (r) => r.categoria || '—' },
    { header: 'Costo', render: (r) => formatMoney(r.precio_costo), className: 'tabular-nums' },
    { header: 'Venta', render: (r) => formatMoney(r.precio_venta), className: 'tabular-nums' },
    {
      header: 'Margen',
      render: (r) => <span className="font-semibold text-accent-2">{formatPct(r.margen_pct)}</span>,
      className: 'tabular-nums',
    },
    { header: 'Stock', render: (r) => r.stock, className: 'tabular-nums' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-accent-2/30 bg-accent-2/5 p-3 text-sm text-text-dim">
        Ranking por <strong className="text-text">margen potencial</strong> (precio de venta vs. costo). Cuando
        exista el módulo de Ventas (Fase 2) se va a poder ordenar también por rentabilidad real vendida.
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Calculando ranking…
        </div>
      )}
      {isError && (
        <div className="flex flex-col items-center gap-2 py-16 text-danger">
          <AlertTriangle size={20} /> No se pudo cargar el ranking.
        </div>
      )}
      {data && (
        <Table
          columns={columns}
          rows={data}
          rowKey={(r) => r.id}
          emptyMessage="Todavía no hay productos con precio cargado."
        />
      )}
    </div>
  )
}
