import { useState } from 'react'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { useCombos } from './api'
import { ComboFormModal } from './ComboFormModal'
import type { Combo } from './types'

export function Combos() {
  const [showForm, setShowForm] = useState(false)
  const { data: combos, isLoading, isError } = useCombos()

  const columns: Column<Combo>[] = [
    { header: 'Combo', render: (c) => <span className="font-medium">{c.nombre}</span> },
    { header: 'Productos', render: (c) => c.items.map((i) => `${i.cantidad}× ${i.producto_nombre}`).join(', ') || '—' },
    { header: 'Precio', render: (c) => formatMoney(c.precio), className: 'tabular-nums' },
    { header: 'Estado', render: (c) => (c.activo ? <span className="text-accent-2">Activo</span> : <span className="text-text-dim">Inactivo</span>) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">Agrupá productos con un precio especial de combo.</p>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={15} /> Nuevo combo
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando combos…
        </div>
      )}
      {isError && (
        <div className="flex flex-col items-center gap-2 py-16 text-danger">
          <AlertTriangle size={20} /> No se pudieron cargar los combos.
        </div>
      )}
      {combos && (
        <Table columns={columns} rows={combos} rowKey={(c) => c.id} emptyMessage="Todavía no armaste ningún combo." />
      )}

      {showForm && <ComboFormModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
