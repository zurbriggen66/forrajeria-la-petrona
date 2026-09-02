import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

interface Props {
  titulo: string
  /** Qué va a pasar, en concreto. Si la acción no tiene vuelta atrás, decilo acá. */
  descripcion: string
  confirmarTexto?: string
  cancelarTexto?: string
  peligro?: boolean
  cargando?: boolean
  /** Pide un motivo obligatorio antes de dejar confirmar. Lo usa el borrado de
   * un movimiento de cuenta corriente: eso le cambia el saldo a un cliente y
   * tiene que quedar dicho por qué, igual que al anular una venta. */
  pedirMotivo?: { label: string; placeholder?: string }
  /** Recibe el motivo cuando se pidió; cadena vacía cuando no. Los que no lo
   * piden pueden seguir declarando `() => void`. */
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
}

/** Confirmación de una acción con consecuencias.
 *
 * Reemplaza a window.confirm, que abre el diálogo gris del sistema operativo
 * en medio de la UI oscura y no deja explicar qué se está por hacer.
 * Generaliza el patrón que ya usaba TicketDetalleModal para anular una venta.
 *
 * Escape cancela y el foco arranca en Cancelar (no en Confirmar): si alguien
 * llega acá de rebote y aprieta Enter, no borra nada. */
export function ConfirmDialog({
  titulo, descripcion, confirmarTexto = 'Confirmar', cancelarTexto = 'Cancelar',
  peligro = false, cargando = false, pedirMotivo, onConfirmar, onCancelar,
}: Props) {
  const [motivo, setMotivo] = useState('')
  const faltaMotivo = Boolean(pedirMotivo) && motivo.trim() === ''
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onCancelar])

  return (
    <Modal title={titulo} onClose={onCancelar}>
      <div className="flex flex-col gap-5">
        <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
          peligro ? 'border-danger/40 bg-danger/10 text-danger' : 'border-border bg-surface-2 text-text-dim'
        }`}>
          {peligro && <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
          <p>{descripcion}</p>
        </div>

        {pedirMotivo && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-motivo" className="text-xs font-medium uppercase tracking-wide text-text-dim">
              {pedirMotivo.label}
            </label>
            {/* El foco arranca acá y no en Cancelar: con el motivo vacío el
                botón de confirmar está deshabilitado, así que un Enter de
                rebote no puede ejecutar nada. */}
            <textarea
              id="confirm-motivo"
              autoFocus
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={pedirMotivo.placeholder}
              className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-xs text-text-dim">Queda guardado en el registro de cambios, con tu nombre y la fecha.</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          {/* autoFocus y no un ref: viaja solo por el spread de props de
              Button, sin tener que hacerle forwardRef para esto. */}
          <Button autoFocus={!pedirMotivo} type="button" variant="ghost" onClick={onCancelar}>
            {cancelarTexto}
          </Button>
          <Button
            type="button"
            variant={peligro ? 'danger' : 'primary'}
            onClick={() => onConfirmar(motivo.trim())}
            disabled={cargando || faltaMotivo}
          >
            {confirmarTexto}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
