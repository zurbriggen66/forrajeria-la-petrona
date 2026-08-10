import { useState } from 'react'
import { AlertTriangle, Boxes, Loader2, PackageX, Wallet } from 'lucide-react'
import { KpiCard } from '../../components/ui/KpiCard'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { useProductos } from '../productos/api'
import type { Producto } from '../productos/types'
import { useInventarioResumen } from './api'

type Filtro = 'todos' | 'bajo' | 'sin_stock'

const TABS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'bajo', label: 'Stock Bajo' },
  { key: 'sin_stock', label: 'Sin Stock' },
]

export function EstadoInventario() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const { data: resumen, isLoading: loadingResumen } = useInventarioResumen()
  const { data: productos, isLoading: loadingProductos } = useProductos(
    filtro === 'todos' ? { ordering: 'nombre' } : { stock_status: filtro, ordering: 'nombre' },
  )

  const columns: Column<Producto>[] = [
    { header: 'Producto', render: (p) => p.nombre },
    { header: 'Categoría', render: (p) => p.categoria || '—' },
    { header: 'Stock', render: (p) => `${p.stock}${p.venta_por_peso ? ` ${p.unidad_medida}` : ''}`, className: 'tabular-nums' },
    { header: 'Mínimo', render: (p) => p.stock_minimo, className: 'tabular-nums' },
    {
      header: 'Estado',
      render: (p) =>
        Number(p.stock) <= 0 ? (
          <span className="inline-flex items-center gap-1 text-danger"><PackageX size={13} /> Sin stock</span>
        ) : p.stock_bajo ? (
          <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle size={13} /> Stock bajo</span>
        ) : (
          <span className="text-accent-2">OK</span>
        ),
    },
    { header: 'Valorizado (costo)', render: (p) => formatMoney(Number(p.stock) * Number(p.precio_costo)), className: 'tabular-nums' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Valor de stock (costo)"
          value={loadingResumen ? '—' : formatMoney(resumen?.valor_stock_costo ?? 0)}
          subtitle={loadingResumen ? undefined : `${resumen?.total_productos ?? 0} productos activos`}
          icon={Wallet}
        />
        <KpiCard
          label="Valor de stock (venta)"
          value={loadingResumen ? '—' : formatMoney(resumen?.valor_stock_venta ?? 0)}
          icon={Boxes}
          accent="accent-2"
        />
        <KpiCard
          label="Stock bajo"
          value={loadingResumen ? '—' : String(resumen?.stock_bajo_count ?? 0)}
          icon={AlertTriangle}
          accent="warning"
        />
        <KpiCard
          label="Sin stock"
          value={loadingResumen ? '—' : String(resumen?.sin_stock_count ?? 0)}
          icon={PackageX}
          accent="danger"
        />
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              filtro === t.key ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingProductos ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando inventario…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={productos?.results ?? []}
          rowKey={(p) => p.id}
          emptyMessage={filtro === 'todos' ? 'Todavía no cargaste productos.' : 'No hay productos en este filtro.'}
        />
      )}
    </div>
  )
}
