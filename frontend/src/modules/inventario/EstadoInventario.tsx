import { useState } from 'react'
import { AlertTriangle, Boxes, Loader2, Package, PackageX, Scale, Wallet } from 'lucide-react'
import { KpiCard } from '../../components/ui/KpiCard'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { useProductos } from '../productos/api'
import { formatCantidadStock } from '../productos/stock'
import type { Producto } from '../productos/types'
import { useInventarioResumen } from './api'

type Filtro = 'todos' | 'bajo' | 'sin_stock'

const TABS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'bajo', label: 'Stock Bajo' },
  { key: 'sin_stock', label: 'Sin Stock' },
]

function EstadoPill({ stock, stockBajo }: { stock: number; stockBajo: boolean }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
        <PackageX size={12} /> Sin stock
      </span>
    )
  }
  if (stockBajo) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        <AlertTriangle size={12} /> Stock bajo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-2/40 bg-accent-2/10 px-2 py-0.5 text-xs font-medium text-accent-2">
      OK
    </span>
  )
}

/** Barra relativa al mínimo (no a un "máximo" que no existe en el modelo):
 * a 2x el mínimo ya se ve llena, total = a un vistazo se nota qué tan lejos
 * está cada producto del punto de reposición. */
function BarraStock({ stock, minimo }: { stock: number; minimo: number }) {
  if (minimo <= 0) return null
  const pct = Math.max(4, Math.min(100, (stock / (minimo * 2)) * 100))
  const color = stock <= 0 ? 'bg-danger' : stock <= minimo ? 'bg-warning' : 'bg-accent-2'
  return (
    <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EstadoInventario() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const { data: resumen, isLoading: loadingResumen } = useInventarioResumen()
  const { data: productos, isLoading: loadingProductos } = useProductos(
    filtro === 'todos'
      ? { activo: true, ordering: 'nombre' }
      : { activo: true, stock_status: filtro, ordering: 'stock' },
  )

  const columns: Column<Producto>[] = [
    {
      header: 'Producto',
      render: (p) => (
        <div className="flex items-start gap-2">
          {p.venta_por_peso ? (
            <Scale size={14} className="mt-0.5 shrink-0 text-text-dim" />
          ) : (
            <Package size={14} className="mt-0.5 shrink-0 text-text-dim" />
          )}
          <div>
            <div className="font-medium text-text">{p.nombre}</div>
            {p.categoria && (
              <span className="mt-1 inline-block rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
                {p.categoria}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Stock',
      render: (p) => (
        <div>
          <span className="tabular-nums text-text">{formatCantidadStock(p.stock, p)}</span>
          <BarraStock stock={Number(p.stock)} minimo={Number(p.stock_minimo)} />
        </div>
      ),
    },
    { header: 'Mínimo', render: (p) => formatCantidadStock(p.stock_minimo, p), className: 'tabular-nums text-text-dim' },
    { header: 'Estado', render: (p) => <EstadoPill stock={Number(p.stock)} stockBajo={p.stock_bajo} /> },
    { header: 'Valorizado (costo)', render: (p) => formatMoney(Number(p.stock) * Number(p.precio_costo)), className: 'tabular-nums text-text' },
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
