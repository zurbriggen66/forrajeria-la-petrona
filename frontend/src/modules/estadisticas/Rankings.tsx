import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { FiltrosBar } from '../ventas/FiltrosBar'
import type { VentasFiltros } from '../ventas/types'
import { useRankings } from './api'
import type { TopProducto, TopVendedor } from './types'

export function Rankings() {
  const [filtros, setFiltros] = useState<VentasFiltros>({})
  const { data, isLoading } = useRankings(filtros)

  const columnasProductos: Column<TopProducto>[] = [
    { header: 'Producto', render: (p) => p.nombre },
    { header: 'Cantidad vendida', render: (p) => p.cantidad, className: 'tabular-nums' },
    { header: 'Ingresos', render: (p) => formatMoney(p.ingresos), className: 'tabular-nums' },
  ]

  const columnasVendedores: Column<TopVendedor>[] = [
    { header: 'Vendedor', render: (v) => v.nombre },
    { header: 'Cantidad de ventas', render: (v) => v.cantidad_ventas, className: 'tabular-nums' },
    { header: 'Ingresos', render: (v) => formatMoney(v.ingresos), className: 'tabular-nums' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <FiltrosBar value={filtros} onChange={setFiltros} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando rankings…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div>
            <h2 className="mb-2 font-display text-base font-semibold text-text">Top productos</h2>
            <Table
              columns={columnasProductos}
              rows={data?.top_productos ?? []}
              rowKey={(p) => p.producto ?? p.nombre}
              emptyMessage="Sin ventas en el período."
            />
          </div>
          <div>
            <h2 className="mb-2 font-display text-base font-semibold text-text">Top vendedores</h2>
            <Table
              columns={columnasVendedores}
              rows={data?.top_vendedores ?? []}
              rowKey={(v) => v.vendedor ?? v.nombre}
              emptyMessage="Sin ventas en el período."
            />
          </div>
        </div>
      )}
    </div>
  )
}
