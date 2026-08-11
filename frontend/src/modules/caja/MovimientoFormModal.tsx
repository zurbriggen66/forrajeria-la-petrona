import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCrearMovimiento, useCuentasPago, useTransferir } from './api'

type Modo = 'ingreso' | 'egreso' | 'transferencia'

const TITULOS: Record<Modo, string> = {
  ingreso: 'Ingresar dinero',
  egreso: 'Retirar dinero',
  transferencia: 'Transferir entre contenedores',
}

export function MovimientoFormModal({ modo, onClose }: { modo: Modo; onClose: () => void }) {
  const { toast } = useToast()
  const { data: cuentas } = useCuentasPago(true)
  const crearMovimiento = useCrearMovimiento()
  const transferir = useTransferir()

  const [cuenta, setCuenta] = useState('')
  const [cuentaDestino, setCuentaDestino] = useState('')
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')

  const pendiente = modo === 'transferencia' ? transferir.isPending : crearMovimiento.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      if (modo === 'transferencia') {
        if (!cuenta || !cuentaDestino) {
          toast('Elegí origen y destino', 'error')
          return
        }
        await transferir.mutateAsync({ cuenta_origen: cuenta, cuenta_destino: cuentaDestino, monto, concepto })
      } else {
        await crearMovimiento.mutateAsync({
          tipo: modo === 'ingreso' ? 'ingreso' : 'egreso',
          cuenta: cuenta || null,
          monto,
          concepto,
        })
      }
      toast(modo === 'transferencia' ? 'Transferencia registrada' : 'Movimiento registrado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo registrar el movimiento'), 'error')
    }
  }

  return (
    <Modal title={TITULOS[modo]} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          id="cuenta" label={modo === 'transferencia' ? 'Desde' : 'Contenedor'}
          value={cuenta} onChange={(e) => setCuenta(e.target.value)} required={modo === 'transferencia'}
        >
          <option value="">{modo === 'transferencia' ? 'Elegí un contenedor…' : 'Efectivo (por defecto)'}</option>
          {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>

        {modo === 'transferencia' && (
          <Select id="cuenta-destino" label="Hacia" value={cuentaDestino} onChange={(e) => setCuentaDestino(e.target.value)} required>
            <option value="">Elegí un contenedor…</option>
            {cuentas?.filter((c) => c.id !== cuenta).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        )}

        <Input
          id="monto" label="Monto" type="number" min="0.01" step="0.01" required autoFocus
          value={monto} onChange={(e) => setMonto(e.target.value)}
        />
        <Input
          id="concepto" label="Motivo (opcional)" value={concepto}
          onChange={(e) => setConcepto(e.target.value)} placeholder={modo === 'egreso' ? 'Ej: Pago proveedor' : ''}
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pendiente}>
            {pendiente && <Loader2 size={14} className="animate-spin" />}
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
