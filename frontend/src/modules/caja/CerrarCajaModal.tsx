import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useCerrarCaja } from './api'
import type { CajaSesion, CajaSesionActual, Conteo } from './types'

function claseDiferencia(diferencia: number) {
  if (diferencia === 0) return 'border-accent-2/40 text-accent-2'
  return diferencia > 0 ? 'border-warning/40 text-warning' : 'border-danger/40 text-danger'
}

/** Una fila del resultado del arqueo. Se muestra por contenedor porque un
 * faltante de billetes y un desfasaje del banco no se arreglan igual. */
function FilaResultado({ conteo }: { conteo: Conteo }) {
  const diferencia = Number(conteo.diferencia)
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="text-sm text-text">{conteo.cuenta_nombre}</span>
      <span className="flex items-baseline gap-3 text-xs tabular-nums text-text-dim">
        <span>esperado {formatMoney(conteo.esperado)}</span>
        <span>contado {formatMoney(conteo.contado)}</span>
        <span className={`w-24 text-right text-sm font-medium ${
          diferencia === 0 ? 'text-accent-2' : diferencia > 0 ? 'text-warning' : 'text-danger'
        }`}>
          {diferencia > 0 ? '+' : ''}{formatMoney(diferencia)}
        </span>
      </span>
    </div>
  )
}

export function CerrarCajaModal({ sesion, onClose }: { sesion: CajaSesionActual; onClose: () => void }) {
  const { toast } = useToast()
  const cerrarCaja = useCerrarCaja()
  // Sólo se tipea lo que se cuenta a mano. Un contenedor que se deja vacío se
  // envía sin conteo y el backend lo da por bueno — la plata que entró por
  // transferencia está en el banco, no hay nada que contar.
  const [contado, setContado] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<CajaSesion | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const conteos = Object.entries(contado)
      .filter(([, monto]) => monto !== '')
      .map(([cuenta, monto]) => ({ cuenta, contado: monto }))

    if (conteos.length === 0) {
      toast('Contá al menos el efectivo antes de cerrar', 'error')
      return
    }
    try {
      setResultado(await cerrarCaja.mutateAsync({ id: sesion.id, conteos }))
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cerrar la caja'), 'error')
    }
  }

  if (resultado) {
    const diferencia = Number(resultado.diferencia ?? 0)
    return (
      <Modal title="Turno cerrado" onClose={onClose} wide>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-2 text-accent-2">
            <CheckCircle2 size={28} />
          </div>

          <div className="rounded-lg border border-border bg-surface-2 px-4 py-2">
            {resultado.conteos.map((c) => <FilaResultado key={c.cuenta} conteo={c} />)}
          </div>

          <div className={`rounded-lg border p-3 text-center text-sm ${claseDiferencia(diferencia)}`}>
            Diferencia total: <span className="font-semibold tabular-nums">{formatMoney(diferencia)}</span>
            {diferencia === 0 && ' — el arqueo cerró exacto.'}
            {diferencia > 0 && ' — sobró plata.'}
            {diferencia < 0 && ' — faltó plata.'}
          </div>

          <Button onClick={onClose} className="w-full justify-center">Listo</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Cerrar turno" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-dim">
          Contá cada contenedor por separado. El efectivo es el que hay que contar de verdad;
          los demás podés dejarlos vacíos y se toman por buenos.
        </p>

        <div className="flex flex-col gap-3">
          {sesion.contenedores.map((c, i) => (
            <div key={c.cuenta} className="flex items-end gap-3">
              <Input
                id={`conteo-${c.cuenta}`}
                label={c.nombre}
                type="number" min="0" step="0.01" placeholder="sin contar"
                autoFocus={i === 0}
                value={contado[c.cuenta] ?? ''}
                onChange={(e) => setContado((prev) => ({ ...prev, [c.cuenta]: e.target.value }))}
                className="flex-1"
              />
              <span className="pb-2 whitespace-nowrap text-xs tabular-nums text-text-dim">
                el sistema dice {formatMoney(c.saldo_turno)}
              </span>
            </div>
          ))}
        </div>

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
