import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCrearMovimientoProveedor } from './api'

export function MovimientoProveedorFormModal({
  proveedorId, tipo, onClose,
}: {
  proveedorId: string
  tipo: 'pago' | 'ajuste'
  onClose: () => void
}) {
  const { toast } = useToast()
  const crearMovimiento = useCrearMovimientoProveedor(proveedorId)
  const [monto, setMonto] = useState('')
  const [referencia, setReferencia] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await crearMovimiento.mutateAsync({ tipo, monto, referencia })
      toast(tipo === 'pago' ? 'Pago registrado' : 'Ajuste registrado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo registrar el movimiento'), 'error')
    }
  }

  return (
    <Modal title={tipo === 'pago' ? 'Registrar pago' : 'Ajuste de cuenta corriente'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="monto" label={tipo === 'pago' ? 'Monto pagado' : 'Monto (negativo para restar saldo)'}
          type="number" step="0.01" required autoFocus
          min={tipo === 'pago' ? '0.01' : undefined}
          value={monto} onChange={(e) => setMonto(e.target.value)}
        />
        <Input id="referencia" label="Referencia (opcional)" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={crearMovimiento.isPending}>
            {crearMovimiento.isPending && <Loader2 size={14} className="animate-spin" />}
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
