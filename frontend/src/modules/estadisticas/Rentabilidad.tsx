import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney, formatPct } from '../../lib/format'
import { FiltrosBar } from '../ventas/FiltrosBar'
import type { VentasFiltros } from '../ventas/types'
import { useRentabilidad } from './api'
import type { RentabilidadProducto } from './types'

export function Rentabilidad() {
  const [filtros, setFiltros] = useState<VentasFiltros>({})
  const { data, isLoading } = useRentabilidad(filtros)

  const columns: Column<RentabilidadProducto>[] = [
    { header: 'Producto', render: (p) => p.nombre },
    { header: 'Categoría', render: (p) => p.categoria },
    { header: 'Cantidad', render: (p) => p.cantidad, className: 'tabular-nums' },
    { header: 'Ingresos', render: (p) => formatMoney(p.ingresos), className: 'tabular-nums' },
    { header: 'Costo', render: (p) => formatMoney(p.costo), className: 'tabular-nums' },
    {
      header: 'Margen real',
      className: 'tabular-nums',
      render: (p) => (
        <span className={p.margen_pct >= 30 ? 'text-accent-2' : p.margen_pct >= 0 ? 'text-warning' : 'text-danger'}>
          {formatPct(p.margen_pct)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-dim">
        Margen real (precio de venta vs. costo) calculado sobre ventas efectivamente registradas — no sobre la
        lista de precios. Para el margen potencial por lista, ver Inventario &gt; Ranking rentabilidad.
      </p>
      <FiltrosBar value={filtros} onChange={setFiltros} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Calculando…
        </div>
      ) : (
        <Table columns={columns} rows={data ?? []} rowKey={(p) => p.producto} emptyMessage="Sin ventas en el período." />
      )}
    </div>
  )
}
