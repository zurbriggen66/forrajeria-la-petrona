import { useEffect, useState } from 'react'
import { AlertTriangle, CloudOff, Loader2, RefreshCcw, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { formatMoney } from '../../lib/format'
import { listarPendientes, quitarPendiente, reencolar, type VentaPendiente } from './offlineQueue'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Las ventas que el POS guardó sin conexión: las que esperan turno y las que
 * el servidor rechazó.
 *
 * Existe porque antes una venta rechazada se borraba de IndexedDB dejando sólo
 * un toast de 4 segundos: si el cajero no estaba mirando la pantalla, esa
 * venta desaparecía sin que quedara registro de cuál era ni de cuánto era. */
export function VentasPendientesModal({ onClose, onSincronizar, sincronizando }: {
  onClose: () => void
  onSincronizar: () => void
  sincronizando: boolean
}) {
  const [ventas, setVentas] = useState<VentaPendiente[] | null>(null)
  const [aDescartar, setADescartar] = useState<VentaPendiente | null>(null)

  async function refrescar() {
    setVentas(await listarPendientes())
  }

  useEffect(() => { refrescar() }, [])

  async function handleReintentar(venta: VentaPendiente) {
    await reencolar(venta.sync_uuid)
    await refrescar()
    onSincronizar()
  }

  async function handleDescartar(venta: VentaPendiente) {
    await quitarPendiente(venta.sync_uuid)
    setADescartar(null)
    await refrescar()
  }

  return (
    <Modal title="Ventas guardadas sin conexión" onClose={onClose} ancho="lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-text-dim">
            Se sincronizan solas al volver la conexión. Las rechazadas quedan acá hasta que las
            resuelvas — no se borran nunca solas.
          </p>
          <Button variant="secondary" onClick={onSincronizar} disabled={sincronizando}>
            {sincronizando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
            Sincronizar ahora
          </Button>
        </div>

        {ventas === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-text-dim">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : ventas.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-dim">
            No hay ventas offline guardadas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {ventas.map((v) => {
              const rechazada = v.estado === 'rechazada'
              return (
                <div
                  key={v.sync_uuid}
                  className={`flex flex-col gap-2 rounded-lg border p-3 text-sm ${
                    rechazada ? 'border-danger/40 bg-danger/5' : 'border-border bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`flex items-center gap-2 ${rechazada ? 'text-danger' : 'text-text-dim'}`}>
                      {rechazada ? <AlertTriangle size={14} /> : <CloudOff size={14} />}
                      {rechazada ? 'Rechazada' : 'Esperando conexión'}
                      <span className="text-text-dim">· {formatFecha(v.creada_en)}</span>
                    </span>
                    <span className="tabular-nums font-medium text-text">
                      {v.total !== undefined ? formatMoney(v.total) : `${v.payload.items.length} ítems`}
                    </span>
                  </div>

                  {rechazada && v.motivo && (
                    <p className="text-xs text-danger">{v.motivo}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-text-dim">
                    <span>{v.payload.items.length} producto{v.payload.items.length === 1 ? '' : 's'}</span>
                    {v.intentos > 0 && <span>· {v.intentos} intento{v.intentos === 1 ? '' : 's'}</span>}
                    {rechazada && (
                      <div className="ml-auto flex gap-2">
                        <Button variant="secondary" onClick={() => handleReintentar(v)} className="!px-2 !py-1 text-xs">
                          <RefreshCcw size={12} /> Reintentar
                        </Button>
                        <Button variant="danger" onClick={() => setADescartar(v)} className="!px-2 !py-1 text-xs">
                          <Trash2 size={12} /> Descartar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {aDescartar && (
        <ConfirmDialog
          titulo="Descartar venta rechazada"
          descripcion="Esta venta no se va a registrar nunca y se borra de este dispositivo. Si la cobraste de verdad, cargala de nuevo en el POS antes de descartarla."
          confirmarTexto="Descartar" peligro
          onConfirmar={() => handleDescartar(aDescartar)}
          onCancelar={() => setADescartar(null)}
        />
      )}
    </Modal>
  )
}
