import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useCerrarCaja } from './api'
import type { CajaSesion } from './types'

export function CerrarCajaModal({ sesion, onClose }: { sesion: CajaSesion; onClose: () => void }) {
  const { toast } = useToast()
  const cerrarCaja = useCerrarCaja()
  const [montoCierre, setMontoCierre] = useState('')
  const [resultado, setResultado] = useState<CajaSesion | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      const data = await cerrarCaja.mutateAsync({ id: sesion.id, monto_cierre: montoCierre })
      setResultado(data)
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cerrar la caja'), 'error')
    }
  }

  if (resultado) {
    const diferencia = Number(resultado.diferencia ?? 0)
    return (
      <Modal title="Turno cerrado" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle2 size={40} className="text-accent-2" />
          <div className="grid w-full grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs uppercase tracking-wide text-text-dim">Esperado</p>
              <p className="mt-1 font-display text-lg tabular-nums">{formatMoney(resultado.monto_esperado ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs uppercase tracking-wide text-text-dim">Contado</p>
              <p className="mt-1 font-display text-lg tabular-nums">{formatMoney(resultado.monto_cierre ?? 0)}</p>
            </div>
          </div>
          <div
            className={`w-full rounded-lg border p-3 text-sm ${
              diferencia === 0
                ? 'border-accent-2/40 text-accent-2'
                : diferencia > 0
                  ? 'border-warning/40 text-warning'
                  : 'border-danger/40 text-danger'
            }`}
          >
            Diferencia: <span className="font-semibold tabular-nums">{formatMoney(diferencia)}</span>
            {diferencia === 0 && ' — el arqueo cerró exacto.'}
            {diferencia > 0 && ' — sobró plata en caja.'}
            {diferencia < 0 && ' — faltó plata en caja.'}
          </div>
          <Button onClick={onClose} className="mt-2 w-full justify-center">
            Listo
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Cerrar turno" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-dim">
          Contá el efectivo físico y el resto de los contenedores, y cargá acá el total. El sistema calcula
          el esperado (apertura + ingresos − egresos) y te muestra la diferencia.
        </p>
        <Input
          id="monto-cierre" label="Recuento total" type="number" min="0" step="0.01" required autoFocus
          value={montoCierre} onChange={(e) => setMontoCierre(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="danger" disabled={cerrarCaja.isPending}>
            {cerrarCaja.isPending && <Loader2 size={14} className="animate-spin" />}
            Cerrar caja
          </Button>
        </div>
      </form>
    </Modal>
  )
}
