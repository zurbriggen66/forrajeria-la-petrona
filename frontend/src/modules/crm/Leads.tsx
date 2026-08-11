import { useState } from 'react'
import { Loader2, Plus, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useLeads, useUpdateLead } from './api'
import { LeadFormModal } from './LeadFormModal'
import type { CrmLead, EstadoLead } from './types'

const ESTADOS: { value: EstadoLead; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'negociando', label: 'Negociando' },
  { value: 'ganado', label: 'Ganado' },
  { value: 'perdido', label: 'Perdido' },
]

const COLOR_ESTADO: Record<string, string> = {
  nuevo: 'text-accent',
  contactado: 'text-warning',
  negociando: 'text-warning',
  ganado: 'text-accent-2',
  perdido: 'text-danger',
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR')
}

export function Leads() {
  const [filtroEstado, setFiltroEstado] = useState('')
  const { data: leads, isLoading } = useLeads(filtroEstado || undefined)
  const updateLead = useUpdateLead()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)

  async function cambiarEstado(lead: CrmLead, estado: EstadoLead) {
    try {
      await updateLead.mutateAsync({ id: lead.id, input: { estado } })
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo actualizar el estado'), 'error')
    }
  }

  const columns: Column<CrmLead>[] = [
    { header: 'Nombre', render: (l) => <span className="font-medium">{l.nombre || 'Sin nombre'}</span> },
    { header: 'Contacto', render: (l) => l.telefono || l.email || '—' },
    { header: 'Notas', render: (l) => l.notas || '—' },
    { header: 'Creado', render: (l) => formatFecha(l.created_at) },
    {
      header: 'Estado',
      render: (l) => (
        <Select
          value={l.estado} onChange={(e) => cambiarEstado(l, e.target.value as EstadoLead)}
          disabled={updateLead.isPending} className={`!py-1 text-xs font-medium ${COLOR_ESTADO[l.estado] ?? ''}`}
        >
          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </Select>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <p className="flex items-center gap-2 text-sm text-text-dim">
            <Users size={15} className="text-accent" /> Leads y oportunidades comerciales.
          </p>
          <Select id="f-estado-lead" label="Filtrar por estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </Select>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={15} /> Nuevo lead</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando leads…
        </div>
      ) : (
        <Table columns={columns} rows={leads ?? []} rowKey={(l) => l.id} emptyMessage="Todavía no cargaste ningún lead." />
      )}

      {showForm && <LeadFormModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
