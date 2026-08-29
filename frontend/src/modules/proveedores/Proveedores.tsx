import { useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { CuentaCorrienteModal } from './CuentaCorrienteModal'
import { ProveedorFormModal } from './ProveedorFormModal'
import { useProveedores } from './api'
import type { Proveedor } from './types'

export function Proveedores() {
  const { data: proveedores, isLoading, error, refetch } = useProveedores()
  const [editando, setEditando] = useState<Proveedor | 'nuevo' | null>(null)
  // Guarda sólo el id: si el modal se queda con una copia fija del proveedor,
  // el saldo que muestra queda desactualizado apenas se registra un pago o
  // ajuste (la mutación invalida la lista, pero no ese objeto ya capturado).
  // Derivarlo de `proveedores` en cada render lo mantiene siempre al día.
  const [cuentaDeId, setCuentaDeId] = useState<string | null>(null)
  const cuentaDe = proveedores?.find((p) => p.id === cuentaDeId) ?? null

  const columns: Column<Proveedor>[] = [
    { header: 'Nombre', render: (p) => <span className="font-medium">{p.nombre}</span> },
    { header: 'Categoría', render: (p) => p.categoria || '—' },
    { header: 'Contacto', render: (p) => p.contacto || p.telefono || '—' },
    {
      header: 'Saldo',
      className: 'tabular-nums',
      render: (p) => {
        const saldo = Number(p.saldo_actual)
        return <span className={saldo > 0 ? 'text-danger' : saldo < 0 ? 'text-accent-2' : 'text-text-dim'}>{formatMoney(p.saldo_actual)}</span>
      },
    },
    { header: 'Estado', render: (p) => (p.activo ? <span className="text-accent-2">Activo</span> : <span className="text-text-dim">Inactivo</span>) },
    {
      header: '',
      render: (p) => (
        <button
          onClick={(e) => { e.stopPropagation(); setEditando(p) }}
          className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-text"
        >
          <Pencil size={14} />
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">Proveedores y su cuenta corriente. Hacé clic en una fila para ver los movimientos.</p>
        <Button onClick={() => setEditando('nuevo')}><Plus size={15} /> Nuevo proveedor</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando proveedores…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={proveedores ?? []}
          rowKey={(p) => p.id}
          emptyMessage="Todavía no cargaste proveedores."
          onRowClick={(p) => setCuentaDeId(p.id)}
          error={error}
          onRetry={refetch}
        />
      )}

      {editando && (
        <ProveedorFormModal proveedor={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />
      )}
      {cuentaDe && <CuentaCorrienteModal proveedor={cuentaDe} onClose={() => setCuentaDeId(null)} />}
    </div>
  )
}
