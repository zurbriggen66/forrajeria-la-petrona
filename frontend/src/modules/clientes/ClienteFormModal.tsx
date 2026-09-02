import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCreateCliente, useUpdateCliente } from './api'
import type { Cliente } from './types'

const TIPOS = [
  { value: 'consumidor_final', label: 'Consumidor final' },
  { value: 'mayorista', label: 'Mayorista' },
  { value: 'empresa', label: 'Empresa' },
]

export function ClienteFormModal({ cliente, onClose, onCreated }: {
  cliente: Cliente | null
  onClose: () => void
  /** Para quien lo abre como atajo (ej. cargar un reparto): recibe el cliente
   * recién creado y lo puede dejar elegido sin volver a buscarlo. */
  onCreated?: (cliente: Cliente) => void
}) {
  const { toast } = useToast()
  const createCliente = useCreateCliente()
  const updateCliente = useUpdateCliente()

  const [nombre, setNombre] = useState(cliente?.nombre ?? '')
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '')
  const [celular, setCelular] = useState(cliente?.celular ?? '')
  const [email, setEmail] = useState(cliente?.email ?? '')
  const [cuit, setCuit] = useState(cliente?.cuit ?? '')
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '')
  const [tipo, setTipo] = useState(cliente?.tipo ?? 'consumidor_final')
  const [limiteCredito, setLimiteCredito] = useState(cliente?.limite_credito ?? '0')
  const [activo, setActivo] = useState(cliente?.activo ?? true)

  const pendiente = createCliente.isPending || updateCliente.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = {
      nombre, telefono, celular, email, cuit, direccion, tipo,
      limite_credito: limiteCredito, activo,
    }
    try {
      if (cliente) {
        await updateCliente.mutateAsync({ id: cliente.id, input })
      } else {
        const creado = await createCliente.mutateAsync(input)
        onCreated?.(creado)
      }
      toast(cliente ? 'Cliente actualizado' : 'Cliente creado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el cliente'), 'error')
    }
  }

  return (
    <Modal title={cliente ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose} ancho="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input id="nombre" label="Nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Select id="tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input id="telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <Input id="celular" label="Celular" value={celular} onChange={(e) => setCelular(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input id="cuit" label="CUIT" value={cuit} onChange={(e) => setCuit(e.target.value)} />
        </div>
        <Input id="direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <Input
          id="limite-credito" label="Límite de crédito (cuenta corriente)" type="number" min="0" step="0.01"
          value={limiteCredito} onChange={(e) => setLimiteCredito(e.target.value)}
        />
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
