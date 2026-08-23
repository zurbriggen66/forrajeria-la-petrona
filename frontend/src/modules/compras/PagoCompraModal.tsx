import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { useCuentasPago } from '../caja/api'
import { usePagarCompra } from './api'
import type { Compra } from './types'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export function PagoCompraModal({ compra, onClose }: { compra: Compra; onClose: () => void }) {
  const { toast } = useToast()
  const { data: cuentas } = useCuentasPago(true)
  const pagar = usePagarCompra()

  const saldo = Number(compra.saldo_pendiente)
  const [fecha, setFecha] = useState(hoyISO())
  // Arranca con el saldo completo: lo más común es cancelar la factura entera.
  const [monto, setMonto] = useState(String(saldo))
  const [cuentaPago, setCuentaPago] = useState('')
  const [notas, setNotas] = useState('')

  const importe = Number(monto || 0)
  const restante = Math.round((saldo - importe) * 100) / 100

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (importe <= 0 || importe > saldo) {
      toast(`El monto tiene que estar entre $0 y ${formatMoney(saldo)}`, 'error')
      return
    }
    try {
      await pagar.mutateAsync({
        id: compra.id,
        input: { fecha, monto, cuenta_pago: cuentaPago || null, notas },
      })
      toast(restante > 0 ? `Pago registrado — queda ${formatMoney(restante)}` : 'Factura saldada')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo registrar el pago'), 'error')
    }
  }

  return (
    <Modal title="Registrar pago" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-dim">{compra.proveedor_nombre ?? 'Sin proveedor'}</span>
            <span className="text-text-dim">{compra.numero_factura || 'sin N° de factura'}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-text-dim">Mercadería recibida</span>
            <span className="text-text">{formatFechaSola(compra.fecha)}</span>
          </div>
          {compra.fecha_vencimiento && (
            <div className="mt-0.5 flex justify-between">
              <span className="text-text-dim">Vence</span>
              <span className="text-text">{formatFechaSola(compra.fecha_vencimiento)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <span className="font-medium text-text">Falta pagar</span>
            <span className="font-display font-semibold tabular-nums text-warning">{formatMoney(saldo)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="fecha-pago" label="Fecha del pago" type="date" required
            value={fecha} onChange={(e) => setFecha(e.target.value)}
          />
          <Input
            id="monto-pago" label="Monto" type="number" min="0.01" step="0.01" required
            value={monto} onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        <Select id="cuenta-pago" label="Pagado desde" value={cuentaPago} onChange={(e) => setCuentaPago(e.target.value)}>
          <option value="">Efectivo (por defecto)</option>
          {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>

        <Input
          id="notas-pago" label="Notas (opcional)" placeholder="Ej: pagué la mitad, el resto a fin de mes"
          value={notas} onChange={(e) => setNotas(e.target.value)}
        />

        {importe > 0 && importe < saldo && (
          <p className="text-xs text-warning">
            Pago parcial: después de este pago van a quedar {formatMoney(restante)}.
          </p>
        )}

        <p className="text-xs text-text-dim">
          Este gasto cuenta en las estadísticas el día del pago, no el día que llegó la mercadería.
          Con la caja abierta también sale del arqueo del turno.
        </p>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pagar.isPending}>
            {pagar.isPending && <Loader2 size={14} className="animate-spin" />}
            Registrar pago
          </Button>
        </div>
      </form>
    </Modal>
  )
}
