import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Paginacion } from '../../components/ui/Paginacion'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { useDebounce } from '../../lib/useDebounce'
import { CLIENTES_POR_PAGINA, useClientes } from './api'
import { ClienteDetalleModal } from './ClienteDetalleModal'
import { ClienteFormModal } from './ClienteFormModal'
import type { Cliente } from './types'

export function Clientes() {
  const [search, setSearch] = useState('')
  const [activo, setActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')
  const [deuda, setDeuda] = useState<'todos' | 'deben' | 'al_dia'>('todos')
  const [ordering, setOrdering] = useState('nombre')
  const [pagina, setPagina] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)

  // Una request cuando deja de tipear, no una por tecla.
  const searchDiferido = useDebounce(search)

  const { data, isLoading, error, refetch } = useClientes({
    search: searchDiferido || undefined,
    ...(activo === 'activos' ? { activo: true } : activo === 'inactivos' ? { activo: false } : {}),
    ...(deuda === 'todos' ? {} : { deuda }),
    ordering,
    page: pagina,
  })

  /** Todo cambio de filtro vuelve a la página 1: la página actual puede no
   * existir en el resultado filtrado. */
  function filtrar(cambio: () => void) {
    cambio()
    setPagina(1)
  }
  // Derivado de la lista en vivo (no una copia local): así, si se edita el
  // cliente desde la ficha, el modal ya abierto muestra los datos frescos.
  const seleccionada = seleccionadaId ? data?.results.find((c) => c.id === seleccionadaId) ?? null : null
  const clientes = data?.results ?? []

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
            value={search} onChange={(e) => filtrar(() => setSearch(e.target.value))}
          />
          <Select id="f-activo" label="Estado" value={activo} onChange={(e) => filtrar(() => setActivo(e.target.value as typeof activo))}>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </Select>
          <Select id="f-deuda" label="Cuenta corriente" value={deuda} onChange={(e) => filtrar(() => setDeuda(e.target.value as typeof deuda))}>
            <option value="todos">Todos</option>
            <option value="deben">Deben</option>
            <option value="al_dia">Al día</option>
          </Select>
          <Select id="f-ordering" label="Ordenar por" value={ordering} onChange={(e) => filtrar(() => setOrdering(e.target.value))}>
            <option value="nombre">Nombre (A-Z)</option>
            <option value="-nombre">Nombre (Z-A)</option>
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
        <>
          <Table
            columns={columns}
            rows={clientes}
            rowKey={(c) => c.id}
            emptyMessage="No hay clientes para este filtro."
            onRowClick={(c) => setSeleccionadaId(c.id)}
            error={error}
            onRetry={refetch}
          />
          <Paginacion
            pagina={pagina} porPagina={CLIENTES_POR_PAGINA}
            total={data?.count ?? 0} onCambiar={setPagina}
          />
        </>
      )}

      {showForm && <ClienteFormModal cliente={null} onClose={() => setShowForm(false)} />}
      {seleccionada && <ClienteDetalleModal cliente={seleccionada} onClose={() => setSeleccionadaId(null)} />}
    </div>
  )
}
