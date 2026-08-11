import { useState, type FormEvent } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useAbrirCaja } from './api'

export function AbrirCajaForm({ subtitle }: { subtitle?: string }) {
  const { toast } = useToast()
  const abrirCaja = useAbrirCaja()
  const [monto, setMonto] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await abrirCaja.mutateAsync(monto || '0')
      toast('Caja abierta')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo abrir la caja'), 'error')
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="rounded-full bg-warning/15 p-3 text-warning">
        <Lock size={22} />
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold text-text">Caja cerrada</h2>
        <p className="mt-1 text-sm text-text-dim">
          {subtitle ?? 'Abrí la caja indicando el monto inicial en efectivo para empezar a operar.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <Input
          id="monto-apertura" label="Monto inicial" type="number" min="0" step="0.01" required autoFocus
          value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0,00"
        />
        <Button type="submit" disabled={abrirCaja.isPending} className="justify-center">
          {abrirCaja.isPending && <Loader2 size={14} className="animate-spin" />}
          Abrir caja
        </Button>
      </form>
    </div>
  )
}
