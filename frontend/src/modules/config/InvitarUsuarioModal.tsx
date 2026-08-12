import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useInvitarUsuario } from './api'
import { ROLES } from './types'

export function InvitarUsuarioModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const invitar = useInvitarUsuario()

  const [email, setEmail] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [rol, setRol] = useState<string>('Cajero')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await invitar.mutateAsync({ email, nombre_completo: nombreCompleto, rol, password })
      toast('Usuario agregado — compartile el email y la contraseña temporal')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo agregar el usuario'), 'error')
    }
  }

  return (
    <Modal title="Agregar usuario" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="email" label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input id="nombre_completo" label="Nombre" value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Select id="rol" label="Rol" value={rol} onChange={(e) => setRol(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input
            id="password" label="Contraseña temporal" type="text" required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <p className="text-xs text-text-dim">
          No hay envío de email automático: anotá esta contraseña y compartísela vos al empleado.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={invitar.isPending}>
            {invitar.isPending && <Loader2 size={14} className="animate-spin" />}
            Agregar usuario
          </Button>
        </div>
      </form>
    </Modal>
  )
}
