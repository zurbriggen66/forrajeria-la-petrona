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
  // Sólo al corregir: cambiarle el saldo a un cliente tiene que quedar dicho
  // por qué, igual que al anular una venta.
  const [motivo, setMotivo] = useState('')
  const enCurso = crearMovimiento.isPending || editarMovimiento.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      if (movimiento) {
        await editarMovimiento.mutateAsync({
          id: movimiento.id,
          input: { monto, referencia, medio_pago: medioPago, motivo },
        })
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
        {movimiento && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo" className="text-xs font-medium uppercase tracking-wide text-text-dim">
              Por qué lo corregís
            </label>
            <textarea
              id="motivo" rows={2} required
              value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: había pagado 250 y se cargó 400"
              className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-xs text-text-dim">
              Queda guardado en el registro de cambios con tu nombre, la fecha y los montos de antes.
            </p>
          </div>
        )}

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
          <Button type="submit" disabled={enCurso || (Boolean(movimiento) && motivo.trim() === '')}>
            {enCurso && <Loader2 size={14} className="animate-spin" />}
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
