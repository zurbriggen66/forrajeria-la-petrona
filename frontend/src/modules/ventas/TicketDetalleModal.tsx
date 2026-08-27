import { useState, type FormEvent } from 'react'
import { AlertTriangle, Ban, Loader2, Pencil, Printer } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Remito } from './Remito'
import { useToast } from '../../context/ToastContext'
import { imprimir } from '../../lib/imprimir'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useAnularVenta } from './api'
import type { Venta } from './types'
import { VentaEditarItemsModal } from './VentaEditarItemsModal'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function TicketDetalleModal({ venta, onClose }: { venta: Venta; onClose: () => void }) {
  const { toast } = useToast()
  const anularVenta = useAnularVenta()
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [editandoItems, setEditandoItems] = useState(false)

  // Sólo se puede corregir lo que quedó fiado: es a la cuenta corriente
  // adonde le pega la diferencia (ver VentaViewSet.editar_items). Una
  // facturada queda fija por integridad fiscal (el CAE ya salió con esos
  // ítems); una anulada no tiene nada que corregir.
  const puedeEditarItems = !venta.anulada && !venta.facturado && Number(venta.monto_cuenta_corriente) > 0

  async function handleAnular(e: FormEvent) {
    e.preventDefault()
    try {
      await anularVenta.mutateAsync({ id: venta.id, motivo })
      toast('Venta anulada')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo anular la venta'), 'error')
    }
  }

  return (
    <Modal title={`Ticket #${venta.numero_ticket ?? '—'}`} onClose={onClose}>
      <Remito venta={venta} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-dim">
          <span>{formatFecha(venta.created_at)}</span>
          <span>{venta.vendedor_nombre ?? 'Sin vendedor'}</span>
          {venta.cliente_nombre && <span>{venta.cliente_nombre}</span>}
        </div>

        {venta.anulada && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            <Ban size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Venta anulada</p>
              <p className="text-text-dim">{venta.motivo_anulacion}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3 font-mono text-sm">
          {venta.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-text-dim">{Number(item.cantidad)}× {item.producto_nombre ?? 'Producto'}</span>
              <span className="tabular-nums text-text">{formatMoney(item.subtotal)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums text-accent">{formatMoney(venta.total)}</span>
          </div>
          {venta.pagos.length > 1 && (
            <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-2 text-xs">
              <span className="text-text-dim">Pago mixto</span>
              {venta.pagos.map((pago) => (
                <div key={pago.id} className="flex justify-between">
                  <span className="text-text-dim">· {pago.cuenta_pago_nombre ?? 'Efectivo'}</span>
                  <span className="tabular-nums text-text">{formatMoney(pago.monto)}</span>
                </div>
              ))}
            </div>
          )}
          {venta.vuelto && Number(venta.vuelto) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-dim">
                Vuelto{venta.vuelto_cuenta_pago_nombre ? ` (por ${venta.vuelto_cuenta_pago_nombre})` : ''}
              </span>
              <span className="tabular-nums text-accent-2">{formatMoney(venta.vuelto)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={imprimir}>
            <Printer size={15} /> Imprimir remito
          </Button>
          {puedeEditarItems && (
            <Button variant="secondary" onClick={() => setEditandoItems(true)}>
              <Pencil size={15} /> Corregir productos
            </Button>
          )}
          {!venta.anulada && !anulando && (
            <Button variant="danger" onClick={() => setAnulando(true)}>
              <Ban size={15} /> Anular venta
            </Button>
          )}
        </div>

        {anulando && (
          <form onSubmit={handleAnular} className="flex flex-col gap-2 rounded-lg border border-danger/30 p-3">
            <label htmlFor="motivo-anulacion" className="flex items-center gap-1.5 text-xs font-medium text-danger">
              <AlertTriangle size={13} /> Motivo de la anulación
            </label>
            <textarea
              id="motivo-anulacion" required autoFocus rows={2} value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Ej: el cliente se arrepintió, error de carga…"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAnulando(false)}>Cancelar</Button>
              <Button type="submit" variant="danger" disabled={anularVenta.isPending}>
                {anularVenta.isPending && <Loader2 size={14} className="animate-spin" />}
                Confirmar anulación
              </Button>
            </div>
          </form>
        )}
      </div>

      {editandoItems && <VentaEditarItemsModal venta={venta} onClose={() => setEditandoItems(false)} />}
    </Modal>
  )
}
