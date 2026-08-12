import { useState, type FormEvent } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useVendedores } from '../ventas/api'
import { useCreateTurno, useDeleteTurno, useUpdateTurno } from './api'
import type { Turno } from './types'

interface TurnoFormModalProps {
  turno?: Turno
  fechaInicial?: string
  empleadoInicial?: string
  onClose: () => void
}

export function TurnoFormModal({ turno, fechaInicial, empleadoInicial, onClose }: TurnoFormModalProps) {
  const { toast } = useToast()
  const { data: empleados } = useVendedores()
  const crear = useCreateTurno()
  const actualizar = useUpdateTurno()
  const eliminar = useDeleteTurno()

  const [empleado, setEmpleado] = useState(turno?.empleado ?? empleadoInicial ?? '')
  const [fecha, setFecha] = useState(turno?.fecha ?? fechaInicial ?? '')
  const [horaInicio, setHoraInicio] = useState(turno?.hora_inicio ?? '')
  const [horaFin, setHoraFin] = useState(turno?.hora_fin ?? '')
  const [notas, setNotas] = useState(turno?.notas ?? '')

  const guardando = crear.isPending || actualizar.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = { empleado, fecha, hora_inicio: horaInicio || null, hora_fin: horaFin || null, notas }
    try {
      if (turno) {
        await actualizar.mutateAsync({ id: turno.id, ...input })
        toast('Turno actualizado')
      } else {
        await crear.mutateAsync(input)
        toast('Turno programado')
      }
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el turno'), 'error')
    }
  }

  async function handleDelete() {
    if (!turno) return
    try {
      await eliminar.mutateAsync(turno.id)
      toast('Turno eliminado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo eliminar el turno'), 'error')
    }
  }

  return (
    <Modal title={turno ? 'Editar turno' : 'Nuevo turno'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select id="empleado" label="Empleado" required value={empleado} onChange={(e) => setEmpleado(e.target.value)}>
          <option value="">Elegí un empleado…</option>
          {empleados?.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre_completo}</option>)}
        </Select>
        <Input id="fecha" label="Fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input id="hora_inicio" label="Hora inicio" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          <Input id="hora_fin" label="Hora fin" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
        </div>
        <Input id="notas" label="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        <div className="flex items-center justify-between gap-3">
          {turno ? (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={eliminar.isPending}>
              <Trash2 size={14} /> Eliminar
            </Button>
          ) : <span />}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 size={14} className="animate-spin" />}
              {turno ? 'Guardar cambios' : 'Programar turno'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
