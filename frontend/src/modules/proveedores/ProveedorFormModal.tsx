import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCreateProveedor, useUpdateProveedor } from './api'
import type { Proveedor } from './types'

export function ProveedorFormModal({ proveedor, onClose }: { proveedor: Proveedor | null; onClose: () => void }) {
  const { toast } = useToast()
  const createProveedor = useCreateProveedor()
  const updateProveedor = useUpdateProveedor()

  const [nombre, setNombre] = useState(proveedor?.nombre ?? '')
  const [cuit, setCuit] = useState(proveedor?.cuit ?? '')
  const [contacto, setContacto] = useState(proveedor?.contacto ?? '')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [email, setEmail] = useState(proveedor?.email ?? '')
  const [direccion, setDireccion] = useState(proveedor?.direccion ?? '')
  const [categoria, setCategoria] = useState(proveedor?.categoria ?? '')
  const [condicionPago, setCondicionPago] = useState(proveedor?.condicion_pago ?? '')
  const [activo, setActivo] = useState(proveedor?.activo ?? true)

  const pendiente = createProveedor.isPending || updateProveedor.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = {
      nombre, cuit, contacto, telefono, email, direccion, categoria,
      condicion_pago: condicionPago, notas: proveedor?.notas ?? '', activo,
    }
    try {
      if (proveedor) {
        await updateProveedor.mutateAsync({ id: proveedor.id, input })
      } else {
        await createProveedor.mutateAsync(input)
      }
      toast(proveedor ? 'Proveedor actualizado' : 'Proveedor creado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el proveedor'), 'error')
    }
  }

  return (
    <Modal title={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose} ancho="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input id="nombre" label="Nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input id="cuit" label="CUIT" value={cuit} onChange={(e) => setCuit(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input id="contacto" label="Contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} />
          <Input id="telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input id="direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input id="categoria" label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ej: Almacén, Bebidas…" />
          <Input id="condicion-pago" label="Condición de pago" value={condicionPago} onChange={(e) => setCondicionPago(e.target.value)} placeholder="Ej: 30 días, contado…" />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-dim">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activo
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pendiente}>
            {pendiente && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
