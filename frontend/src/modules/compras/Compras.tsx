import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { CompraDetalleModal } from './CompraDetalleModal'
import { CompraFiltrosBar } from './CompraFiltrosBar'
import { CompraFormModal } from './CompraFormModal'
import { useCompras } from './api'
import type { Compra, CompraFiltros } from './types'

export function Compras() {
  const [filtros, setFiltros] = useState<CompraFiltros>({})
  const { data: compras, isLoading } = useCompras(filtros)
  const [showForm, setShowForm] = useState(false)
  const [seleccionada, setSeleccionada] = useState<Compra | null>(null)

  const columns: Column<Compra>[] = [
    { header: 'Fecha', render: (c) => formatFechaSola(c.fecha) },
    { header: 'Proveedor', render: (c) => c.proveedor_nombre ?? 'Sin proveedor' },
    { header: 'N° Factura', render: (c) => c.numero_factura || '—' },
    { header: 'Ítems', render: (c) => c.items.length, className: 'tabular-nums' },
    { header: 'Total', render: (c) => formatMoney(c.total), className: 'tabular-nums' },
    {
      header: 'Estado',
      render: (c) => (c.pagado ? <span className="text-accent-2">Pagada</span> : <span className="text-warning">Pendiente</span>),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CompraFiltrosBar value={filtros} onChange={setFiltros} />
        <Button onClick={() => setShowForm(true)} className="shrink-0"><Plus size={15} /> Nueva compra</Button>
      </div>
      <p className="text-xs text-text-dim">
        Cada compra suma stock del producto y actualiza la cuenta corriente del proveedor. Hacé clic en una
        fila para ver el detalle.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando compras…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={compras ?? []}
          rowKey={(c) => c.id}
          emptyMessage="No hay compras para estos filtros."
          onRowClick={setSeleccionada}
        />
      )}

      {showForm && <CompraFormModal onClose={() => setShowForm(false)} />}
      {seleccionada && <CompraDetalleModal compra={seleccionada} onClose={() => setSeleccionada(null)} />}
    </div>
  )
}
