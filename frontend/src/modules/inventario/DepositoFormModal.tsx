import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCreateDeposito } from './api'

export function DepositoFormModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const createDeposito = useCreateDeposito()
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createDeposito.mutateAsync({ nombre, direccion, activo: true })
      toast('Depósito creado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo crear el depósito'), 'error')
    }
  }

  return (
    <Modal title="Nuevo depósito" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="nombre" label="Nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input id="direccion" label="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createDeposito.isPending}>
            {createDeposito.isPending && <Loader2 size={14} className="animate-spin" />}
            Crear
          </Button>
        </div>
      </form>
    </Modal>
  )
}
