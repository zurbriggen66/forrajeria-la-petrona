import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { useClientes } from './api'
import { ClienteDetalleModal } from './ClienteDetalleModal'
import { ClienteFormModal } from './ClienteFormModal'
import type { Cliente } from './types'

export function Clientes() {
  const [search, setSearch] = useState('')
  const [activo, setActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')
  const [deuda, setDeuda] = useState<'todos' | 'deben' | 'al_dia'>('todos')
  const [showForm, setShowForm] = useState(false)
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)

  const { data, isLoading } = useClientes({
    search: search || undefined,
    ...(activo === 'activos' ? { activo: true } : activo === 'inactivos' ? { activo: false } : {}),
  })
  // El filtro de deuda se aplica en el cliente: la lista ya viene completa
  // (page_size 100) y saldo_actual no es un campo booleano que valga la pena
  // sumar como filtro de la API.
  const clientesFiltrados = (data?.results ?? []).filter((c) => {
    if (deuda === 'deben') return Number(c.saldo_actual) > 0
    if (deuda === 'al_dia') return Number(c.saldo_actual) <= 0
    return true
  })
  // Derivado de la lista en vivo (no una copia local): así, si se edita el
  // cliente desde la ficha, el modal ya abierto muestra los datos frescos.
  const seleccionada = seleccionadaId ? data?.results.find((c) => c.id === seleccionadaId) ?? null : null

  const columns: Column<Cliente>[] = [
    { header: 'Nombre', render: (c) => <span className="font-medium">{c.nombre}</span> },
    { header: 'Contacto', render: (c) => c.telefono || c.celular || '—' },
    { header: 'Tipo', render: (c) => c.tipo.replace('_', ' ') },
    {
      header: 'Saldo cta. cte.', className: 'tabular-nums',
      render: (c) => <span className={Number(c.saldo_actual) > 0 ? 'text-danger' : ''}>{formatMoney(c.saldo_actual)}</span>,
    },
    { header: 'Límite', render: (c) => formatMoney(c.limite_credito), className: 'tabular-nums' },
    {
      header: 'Estado',
      render: (c) => (c.activo ? <span className="text-accent-2">Activo</span> : <span className="text-text-dim">Inactivo</span>),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            id="buscar-cliente" label="Buscar" placeholder="Nombre, teléfono, CUIT…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
          <Select id="f-activo" label="Estado" value={activo} onChange={(e) => setActivo(e.target.value as typeof activo)}>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </Select>
          <Select id="f-deuda" label="Cuenta corriente" value={deuda} onChange={(e) => setDeuda(e.target.value as typeof deuda)}>
            <option value="todos">Todos</option>
            <option value="deben">Deben</option>
            <option value="al_dia">Al día</option>
          </Select>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={15} /> Nuevo cliente</Button>
      </div>

      <p className="text-xs text-text-dim">
        Hacé clic en un cliente para ver su cuenta corriente, sus ventas y a qué vendedor está asignado.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando clientes…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={clientesFiltrados}
          rowKey={(c) => c.id}
          emptyMessage="No hay clientes para este filtro."
          onRowClick={(c) => setSeleccionadaId(c.id)}
        />
      )}

      {showForm && <ClienteFormModal cliente={null} onClose={() => setShowForm(false)} />}
      {seleccionada && <ClienteDetalleModal cliente={seleccionada} onClose={() => setSeleccionadaId(null)} />}
    </div>
  )
}
