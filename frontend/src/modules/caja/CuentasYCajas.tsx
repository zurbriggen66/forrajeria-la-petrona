import { useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { useCuentasPago } from './api'
import { CuentaPagoFormModal } from './CuentaPagoFormModal'
import type { CuentaPago } from './types'

export function CuentasYCajas() {
  const { data: cuentas, isLoading } = useCuentasPago()
  const [editando, setEditando] = useState<CuentaPago | null | 'nuevo'>(null)

  const columns: Column<CuentaPago>[] = [
    { header: 'Nombre', render: (c) => <span className="font-medium">{c.nombre}</span> },
    { header: 'Tipo', render: (c) => c.tipo || '—' },
    { header: 'Comisión', render: (c) => `${c.comision_pct}%`, className: 'tabular-nums' },
    {
      header: 'Estado',
      render: (c) => (c.activo ? <span className="text-accent-2">Activo</span> : <span className="text-text-dim">Inactivo</span>),
    },
    {
      header: '',
      render: (c) => (
        <button onClick={() => setEditando(c)} className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-text">
          <Pencil size={14} />
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">
          Contenedores de dinero del comercio (efectivo, banco, tarjetas). Cada venta y movimiento de caja se
          atribuye a uno de ellos.
        </p>
        <Button onClick={() => setEditando('nuevo')}><Plus size={15} /> Nuevo contenedor</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando cuentas…
        </div>
      ) : (
        <Table columns={columns} rows={cuentas ?? []} rowKey={(c) => c.id} emptyMessage="Todavía no cargaste contenedores de dinero." />
      )}

      {editando && (
        <CuentaPagoFormModal cuenta={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />
      )}
    </div>
  )
}
