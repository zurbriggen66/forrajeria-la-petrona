import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { useGastos } from './api'
import { GastoFormModal } from './GastoFormModal'
import type { Gasto } from './types'

export function Gastos() {
  const { data: gastos, isLoading } = useGastos()
  const [showForm, setShowForm] = useState(false)

  const columns: Column<Gasto>[] = [
    { header: 'Fecha', render: (g) => formatFechaSola(g.fecha) },
    { header: 'Categoría', render: (g) => g.categoria || '—' },
    { header: 'Descripción', render: (g) => g.descripcion || '—' },
    { header: 'Contenedor', render: (g) => g.cuenta_nombre ?? '—' },
    { header: 'Monto', render: (g) => formatMoney(g.monto), className: 'tabular-nums text-danger' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">Gastos y pagos a proveedor. Con la caja abierta, se descuentan del arqueo del turno.</p>
        <Button onClick={() => setShowForm(true)}><Plus size={15} /> Nuevo gasto</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando gastos…
        </div>
      ) : (
        <Table columns={columns} rows={gastos ?? []} rowKey={(g) => g.id} emptyMessage="Todavía no registraste gastos." />
      )}

      {showForm && <GastoFormModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
