import { useEffect } from 'react'
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
  onConfirmar: () => void
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
  peligro = false, cargando = false, onConfirmar, onCancelar,
}: Props) {
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

        <div className="flex justify-end gap-3">
          {/* autoFocus y no un ref: viaja solo por el spread de props de
              Button, sin tener que hacerle forwardRef para esto. */}
          <Button autoFocus type="button" variant="ghost" onClick={onCancelar}>
            {cancelarTexto}
          </Button>
          <Button
            type="button"
            variant={peligro ? 'danger' : 'primary'}
            onClick={onConfirmar}
            disabled={cargando}
          >
            {confirmarTexto}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
