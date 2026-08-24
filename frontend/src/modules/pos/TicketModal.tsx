import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, CloudOff, Loader2, Printer, Receipt } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Remito } from '../ventas/Remito'
import { useToast } from '../../context/ToastContext'
import { useFacturarVenta } from '../fiscal/api'
import { imprimir } from '../../lib/imprimir'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { precioUnitario } from './precio'
import type { CartItem, VentaResult } from './types'

export type TicketData =
  | { kind: 'ok'; venta: VentaResult }
  | { kind: 'queued'; items: CartItem[]; total: number }

function QrFiscal({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, url, { width: 120, margin: 0 })
  }, [url])
  return <canvas ref={canvasRef} className="rounded bg-white p-1" />
}

export function TicketModal({ data, onNuevaVenta }: { data: TicketData; onNuevaVenta: () => void }) {
  const { toast } = useToast()
  const facturar = useFacturarVenta()
  const [venta, setVenta] = useState(data.kind === 'ok' ? data.venta : null)

  async function handleFacturar() {
    if (!venta) return
    try {
      const actualizada = await facturar.mutateAsync(venta.id)
      setVenta(actualizada)
      toast('Comprobante fiscal emitido')
    } catch (err) {
      toast(extraerMensajeError(err, 'ARCA rechazó el comprobante'), 'error')
    }
  }

  return (
    <Modal title={venta ? `Ticket #${venta.numero_ticket}` : 'Venta guardada offline'} onClose={onNuevaVenta}>
      {venta && <Remito venta={venta} />}
      <div className="flex flex-col gap-4">
        {venta ? (
          <div className="flex items-center gap-2 rounded-lg bg-accent-2/10 p-3 text-sm text-accent-2">
            <CheckCircle2 size={18} /> Venta registrada correctamente.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            <CloudOff size={18} /> Sin conexión: se guardó en este dispositivo y se va a sincronizar solo apenas vuelva internet.
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3 font-mono text-sm">
          {venta
            ? venta.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  {/* Number(): el backend manda "1.000" (3 decimales) y crudo
                      se lee como mil en vez de uno. */}
                  <span className="text-text-dim">{Number(item.cantidad)}× {item.producto_nombre}</span>
                  <span className="tabular-nums text-text">{formatMoney(item.subtotal)}</span>
                </div>
              ))
            : data.kind === 'queued' && data.items.map((item) => (
                <div key={`${item.producto.id}:${item.esBolsa}`} className="flex justify-between">
                  <span className="text-text-dim">
                    {item.cantidad}× {item.producto.nombre}{item.esBolsa && ` (bolsa ${Number(item.producto.bolsa_kg)}kg)`}
                  </span>
                  <span className="tabular-nums text-text">
                    {formatMoney(precioUnitario(item) * Number(item.cantidad))}
                  </span>
                </div>
              ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums text-accent">
              {formatMoney(venta ? venta.total : data.kind === 'queued' ? data.total : 0)}
            </span>
          </div>
          {/* Con pago mixto hay que ver cuánto entró por cada medio: es lo que
              el cajero cruza contra el posnet y los billetes al cerrar. */}
          {venta && venta.pagos.length > 1 && (
            <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-2 text-xs">
              {venta.pagos.map((pago) => (
                <div key={pago.id} className="flex justify-between">
                  <span className="text-text-dim">{pago.cuenta_pago_nombre ?? 'Efectivo'}</span>
                  <span className="tabular-nums text-text">{formatMoney(pago.monto)}</span>
                </div>
              ))}
            </div>
          )}
          {venta?.vuelto && Number(venta.vuelto) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-dim">
                Vuelto{venta.vuelto_cuenta_pago_nombre ? ` (por ${venta.vuelto_cuenta_pago_nombre})` : ''}
              </span>
              <span className="tabular-nums text-accent-2">{formatMoney(venta.vuelto)}</span>
            </div>
          )}
        </div>

        {venta && (
          venta.facturado ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
              {venta.qr_url && <QrFiscal url={venta.qr_url} />}
              <div className="text-xs text-text-dim">
                <div className="font-medium text-text">CAE {venta.cae}</div>
                <div>Vence {venta.cae_vencimiento}</div>
                <div>Comprobante {venta.punto_venta_factura}-{venta.numero_factura}</div>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={handleFacturar} disabled={facturar.isPending} className="justify-center">
              {facturar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
              Facturar (emitir CAE)
            </Button>
          )
        )}

        {/* Sólo con la venta confirmada: una venta encolada offline todavía no
            tiene número de ticket, y un remito sin número no sirve de nada. */}
        {venta && (
          <Button variant="secondary" onClick={imprimir} className="justify-center">
            <Printer size={15} /> Imprimir remito
          </Button>
        )}

        <Button onClick={onNuevaVenta} className="justify-center py-3">Nueva venta</Button>
      </div>
    </Modal>
  )
}
