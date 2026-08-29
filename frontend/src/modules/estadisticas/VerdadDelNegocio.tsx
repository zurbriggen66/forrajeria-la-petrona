import { useState } from 'react'
import { Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { KpiCard } from '../../components/ui/KpiCard'
import { Table, type Column } from '../../components/ui/Table'
import { formatFechaSola, formatMoney, formatPct } from '../../lib/format'
import { FiltrosBar } from '../ventas/FiltrosBar'
import type { VentasFiltros } from '../ventas/types'
import { useVerdadDelNegocio } from './api'
import type { Comparativa, RentabilidadCategoria, RentabilidadHora, RentabilidadProveedor } from './types'

export function VerdadDelNegocio() {
  const [filtros, setFiltros] = useState<VentasFiltros>({})
  const { data, isLoading } = useVerdadDelNegocio(filtros)

  const columnasCategoria: Column<RentabilidadCategoria>[] = [
    { header: 'Categoría', render: (f) => f.categoria },
    { header: 'Ingresos', render: (f) => formatMoney(f.ingresos), className: 'tabular-nums' },
    { header: 'Costo', render: (f) => formatMoney(f.costo), className: 'tabular-nums' },
    { header: 'Margen real', render: (f) => formatPct(f.margen_pct), className: 'tabular-nums' },
  ]

  const columnasProveedor: Column<RentabilidadProveedor>[] = [
    { header: 'Proveedor', render: (f) => f.nombre },
    { header: 'Ingresos', render: (f) => formatMoney(f.ingresos), className: 'tabular-nums' },
    { header: 'Costo', render: (f) => formatMoney(f.costo), className: 'tabular-nums' },
    { header: 'Margen real', render: (f) => formatPct(f.margen_pct), className: 'tabular-nums' },
  ]

  const columnasHora: Column<RentabilidadHora>[] = [
    { header: 'Hora', render: (f) => `${String(f.hora).padStart(2, '0')}:00` },
    { header: 'Ventas', render: (f) => f.cantidad_ventas, className: 'tabular-nums' },
    { header: 'Ingresos', render: (f) => formatMoney(f.ingresos), className: 'tabular-nums' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-dim">
        Números reales del negocio: rentabilidad por categoría, proveedor y hora, comparados contra el
        período inmediatamente anterior. Sin filtro de fechas, compara los últimos 30 días.
      </p>
      <FiltrosBar value={filtros} onChange={setFiltros} />

      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Calculando…
        </div>
      ) : (
        <>
          <ComparativaCard data={data.comparativa} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div>
              <h2 className="mb-2 font-display text-base font-semibold text-text">Rentabilidad por categoría</h2>
              <Table columns={columnasCategoria} rows={data.por_categoria} rowKey={(f) => f.categoria} emptyMessage="Sin datos." />
            </div>
            <div>
              <h2 className="mb-2 font-display text-base font-semibold text-text">Rentabilidad por proveedor</h2>
              <Table columns={columnasProveedor} rows={data.por_proveedor} rowKey={(f) => f.proveedor ?? f.nombre} emptyMessage="Sin datos." />
            </div>
          </div>

          <div>
            <h2 className="mb-2 font-display text-base font-semibold text-text">Ventas por hora del día</h2>
            <Table columns={columnasHora} rows={data.por_hora} rowKey={(f) => String(f.hora)} emptyMessage="Sin datos." />
          </div>
        </>
      )}
    </div>
  )
}

function ComparativaCard({ data }: { data: Comparativa }) {
  const variacion = data.variacion_ingresos_pct
  const Icono = variacion === null ? Minus : variacion > 0 ? TrendingUp : variacion < 0 ? TrendingDown : Minus
  const color = variacion === null ? 'text-text-dim' : variacion > 0 ? 'text-accent-2' : variacion < 0 ? 'text-danger' : 'text-text-dim'

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-text-dim">
        <span>Período actual: {formatFechaSola(data.periodo_actual.desde)} – {formatFechaSola(data.periodo_actual.hasta)}</span>
        <span>Anterior: {formatFechaSola(data.periodo_anterior.desde)} – {formatFechaSola(data.periodo_anterior.hasta)}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Ingresos período actual" value={formatMoney(data.periodo_actual.ingresos)} accent="accent-2" />
        <KpiCard label="Ingresos período anterior" value={formatMoney(data.periodo_anterior.ingresos)} />
        <div className="tarjeta-viva group relative overflow-hidden rounded-xl border border-border bg-surface p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Variación</span>
          <div className={`mt-2 flex items-center gap-2 font-display text-2xl font-semibold tabular-nums ${color}`}>
            <Icono size={20} />
            {variacion === null ? 'Sin período anterior' : formatPct(variacion)}
          </div>
        </div>
      </div>
    </div>
  )
}
