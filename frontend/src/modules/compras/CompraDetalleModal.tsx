import { CheckCircle2, Clock } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { formatFechaSola, formatMoney } from '../../lib/format'
import type { Compra } from './types'

export function CompraDetalleModal({ compra, onClose }: { compra: Compra; onClose: () => void }) {
  return (
    <Modal title={`Compra ${compra.numero_factura ? `— Fact. ${compra.numero_factura}` : ''}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-dim">
          <span>{formatFechaSola(compra.fecha)}</span>
          <span>{compra.proveedor_nombre ?? 'Sin proveedor'}</span>
          {compra.pagado ? (
            <span className="flex items-center gap-1 text-accent-2"><CheckCircle2 size={13} /> Pagada</span>
          ) : (
            <span className="flex items-center gap-1 text-warning"><Clock size={13} /> Pendiente de pago</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3 font-mono text-sm">
          {compra.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3">
              <span className="text-text-dim">
                {item.cantidad}× {item.producto_nombre ?? 'Producto'}
                <span className="text-text-dim/70"> · {formatMoney(item.costo_unitario)} c/u</span>
              </span>
              <span className="shrink-0 tabular-nums text-text">{formatMoney(item.subtotal)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums text-accent">{formatMoney(compra.total)}</span>
          </div>
        </div>

        {compra.pagado && (
          <p className="text-xs text-text-dim">
            {compra.caja_sesion
              ? 'Se descontó del arqueo de la caja abierta al momento de cargarla.'
              : 'Se marcó pagada, pero no había una caja abierta al cargarla (no generó movimiento de caja).'}
          </p>
        )}
      </div>
    </Modal>
  )
}
