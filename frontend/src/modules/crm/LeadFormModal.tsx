import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCreateLead } from './api'

export function LeadFormModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const createLead = useCreateLead()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createLead.mutateAsync({ nombre, telefono, email, estado: 'nuevo', notas })
      toast('Lead creado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo crear el lead'), 'error')
    }
  }

  return (
    <Modal title="Nuevo lead" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="nombre" label="Nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input id="telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notas" className="text-xs font-medium uppercase tracking-wide text-text-dim">Notas</label>
          <textarea
            id="notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="De dónde salió el contacto, qué le interesa…"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createLead.isPending}>
            {createLead.isPending && <Loader2 size={14} className="animate-spin" />}
            Crear lead
          </Button>
        </div>
      </form>
    </Modal>
  )
}
