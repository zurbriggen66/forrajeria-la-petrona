import { CheckCircle2, CloudOff } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { formatMoney } from '../../lib/format'
import type { CartItem, VentaResult } from './types'

export type TicketData =
  | { kind: 'ok'; venta: VentaResult }
  | { kind: 'queued'; items: CartItem[]; total: number }

export function TicketModal({ data, onNuevaVenta }: { data: TicketData; onNuevaVenta: () => void }) {
  return (
    <Modal title={data.kind === 'ok' ? `Ticket #${data.venta.numero_ticket}` : 'Venta guardada offline'} onClose={onNuevaVenta}>
      <div className="flex flex-col gap-4">
        {data.kind === 'ok' ? (
          <div className="flex items-center gap-2 rounded-lg bg-accent-2/10 p-3 text-sm text-accent-2">
            <CheckCircle2 size={18} /> Venta registrada correctamente.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            <CloudOff size={18} /> Sin conexión: se guardó en este dispositivo y se va a sincronizar solo apenas vuelva internet.
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3 font-mono text-sm">
          {data.kind === 'ok'
            ? data.venta.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="text-text-dim">{item.cantidad}× {item.producto_nombre}</span>
                  <span className="tabular-nums text-text">{formatMoney(item.subtotal)}</span>
                </div>
              ))
            : data.items.map((item) => (
                <div key={item.producto.id} className="flex justify-between">
                  <span className="text-text-dim">{item.cantidad}× {item.producto.nombre}</span>
                  <span className="tabular-nums text-text">
                    {formatMoney(Number(item.producto.oferta_activa && item.producto.precio_oferta ? item.producto.precio_oferta : item.producto.precio_venta) * Number(item.cantidad))}
                  </span>
                </div>
              ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums text-accent">
              {formatMoney(data.kind === 'ok' ? data.venta.total : data.total)}
            </span>
          </div>
          {data.kind === 'ok' && data.venta.vuelto && Number(data.venta.vuelto) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-dim">Vuelto</span>
              <span className="tabular-nums text-accent-2">{formatMoney(data.venta.vuelto)}</span>
            </div>
          )}
        </div>

        <Button onClick={onNuevaVenta} className="justify-center py-3">Nueva venta</Button>
      </div>
    </Modal>
  )
}
