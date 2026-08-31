import { useState } from 'react'
import { PauseCircle, Play, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { formatMoney } from '../../lib/format'
import { subtotalLinea } from './precio'
import type { VentaPausada } from './ventasPausadas'

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function total(venta: VentaPausada) {
  return venta.items.reduce((acc, i) => acc + subtotalLinea(i), 0)
}

/** Las ventas que quedaron a medio cargar. Retomar una NO pierde la que está
 * en el mostrador: si el carrito tiene algo, se pausa sola y quedan las dos
 * (ver PosPage.retomarVenta). */
export function VentasPausadasModal({ ventas, hayCarrito, onRetomar, onDescartar, onClose }: {
  ventas: VentaPausada[]
  hayCarrito: boolean
  onRetomar: (venta: VentaPausada) => void
  onDescartar: (venta: VentaPausada) => void
  onClose: () => void
}) {
  const [aDescartar, setADescartar] = useState<VentaPausada | null>(null)

  return (
    <Modal title="Ventas pausadas" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-text-dim">
          {hayCarrito
            ? 'Al retomar una, la venta que está cargada ahora se pausa sola — no se pierde.'
            : 'Quedan guardadas en esta computadora hasta que las cobres o las descartes.'}
        </p>

        {ventas.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-dim">No hay ventas pausadas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ventas.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm"
              >
                <PauseCircle size={16} className="shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{v.nombre}</p>
                  <p className="text-xs text-text-dim">
                    {v.items.length} línea{v.items.length === 1 ? '' : 's'} · pausada {formatHora(v.pausada_en)}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums font-medium text-text">{formatMoney(total(v))}</span>
                <div className="flex shrink-0 gap-1.5">
                  <Button onClick={() => onRetomar(v)} className="!px-2.5 !py-1.5 text-xs">
                    <Play size={13} /> Retomar
                  </Button>
                  <Button variant="danger" onClick={() => setADescartar(v)} className="!px-2 !py-1.5 text-xs" aria-label="Descartar">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aDescartar && (
        <ConfirmDialog
          titulo="Descartar venta pausada"
          descripcion={`Se van a perder ${aDescartar.items.length} línea${aDescartar.items.length === 1 ? '' : 's'} por ${formatMoney(total(aDescartar))}. Hay que cargarla de nuevo.`}
          confirmarTexto="Descartar" peligro
          onConfirmar={() => { onDescartar(aDescartar); setADescartar(null) }}
          onCancelar={() => setADescartar(null)}
        />
      )}
    </Modal>
  )
}
