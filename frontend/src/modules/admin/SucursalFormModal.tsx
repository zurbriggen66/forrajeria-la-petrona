import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useActualizarSucursal, useCrearSucursal } from './api'
import type { Sucursal } from './types'

export function SucursalFormModal({ sucursal, onClose }: { sucursal?: Sucursal; onClose: () => void }) {
  const { toast } = useToast()
  const crear = useCrearSucursal()
  const actualizar = useActualizarSucursal()

  const [nombre, setNombre] = useState(sucursal?.nombre ?? '')
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? '')
  const [telefono, setTelefono] = useState(sucursal?.telefono ?? '')
  const [email, setEmail] = useState(sucursal?.email ?? '')

  const guardando = crear.isPending || actualizar.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      if (sucursal) {
        await actualizar.mutateAsync({ id: sucursal.id, nombre, direccion, telefono, email })
        toast('Sucursal actualizada')
      } else {
        await crear.mutateAsync({ nombre, direccion, telefono, email })
        toast('Sucursal creada')
      }
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar la sucursal'), 'error')
    }
  }

  return (
    <Modal title={sucursal ? 'Editar sucursal' : 'Nueva sucursal'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="nombre" label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Sucursal Centro" />
        <Input id="direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input id="telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={guardando}>
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {sucursal ? 'Guardar cambios' : 'Crear sucursal'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
