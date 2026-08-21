import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCrearMovimientoCliente, useEditarMovimientoCliente } from './api'
import type { ClienteMovimiento, MedioPago } from './types'

export function ClienteMovimientoFormModal({
  clienteId, tipo, movimiento, onClose,
}: {
  clienteId: string
  tipo: 'pago' | 'ajuste'
  movimiento?: ClienteMovimiento
  onClose: () => void
}) {
  const { toast } = useToast()
  const crearMovimiento = useCrearMovimientoCliente(clienteId)
  const editarMovimiento = useEditarMovimientoCliente(clienteId)
  const [monto, setMonto] = useState(movimiento?.monto ?? '')
  const [referencia, setReferencia] = useState(movimiento?.referencia ?? '')
  const [medioPago, setMedioPago] = useState<MedioPago | ''>(movimiento?.medio_pago ?? 'efectivo')
  const enCurso = crearMovimiento.isPending || editarMovimiento.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      if (movimiento) {
        await editarMovimiento.mutateAsync({ id: movimiento.id, input: { monto, referencia, medio_pago: medioPago } })
        toast('Movimiento corregido')
      } else {
        await crearMovimiento.mutateAsync({ tipo, monto, referencia, medio_pago: medioPago })
        toast(tipo === 'pago' ? 'Pago registrado' : 'Ajuste registrado')
      }
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el movimiento'), 'error')
    }
  }

  const titulo = movimiento
    ? 'Corregir movimiento'
    : tipo === 'pago' ? 'Registrar pago del cliente' : 'Ajuste de cuenta corriente'

  return (
    <Modal title={titulo} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="monto" label={tipo === 'pago' ? 'Monto pagado' : 'Monto (negativo para restar saldo)'}
          type="number" step="0.01" required autoFocus
          min={tipo === 'pago' ? '0.01' : undefined}
          value={monto} onChange={(e) => setMonto(e.target.value)}
        />
        {tipo === 'pago' && (
          <Select id="medio-pago" label="Medio de pago" value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </Select>
        )}
        <Input id="referencia" label="Referencia (opcional)" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={enCurso}>
            {enCurso && <Loader2 size={14} className="animate-spin" />}
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
