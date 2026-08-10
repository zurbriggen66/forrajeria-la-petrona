import { useState } from 'react'
import { Loader2, Percent, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { KpiCard } from '../../components/ui/KpiCard'
import { formatMoney, formatPct } from '../../lib/format'
import { FiltrosBar } from '../ventas/FiltrosBar'
import type { VentasFiltros } from '../ventas/types'
import { useResumen } from './api'

export function Panel() {
  const [filtros, setFiltros] = useState<VentasFiltros>({})
  const { data, isLoading } = useResumen(filtros)

  return (
    <div className="flex flex-col gap-5">
      <FiltrosBar value={filtros} onChange={setFiltros} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Calculando…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <KpiCard label="Ingresos" value={formatMoney(data?.ingresos ?? 0)} icon={TrendingUp} accent="accent-2" />
          <KpiCard label="Egresos" value={formatMoney(data?.egresos ?? 0)} icon={TrendingDown} accent="danger" />
          <KpiCard label="Balance" value={formatMoney(data?.balance ?? 0)} icon={Wallet} />
          <KpiCard label="Margen" value={formatPct(data?.margen_pct)} icon={Percent} accent="accent-2" />
          <KpiCard label="Ticket promedio" value={formatMoney(data?.ticket_promedio ?? 0)} icon={Receipt} />
          <KpiCard label="Cantidad de ventas" value={String(data?.cantidad_ventas ?? 0)} icon={Receipt} />
        </div>
      )}
    </div>
  )
}
