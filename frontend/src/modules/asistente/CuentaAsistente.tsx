import { useState, type FormEvent } from 'react'
import { CreditCard, KeyRound, Loader2, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCuentaAsistente, useGuardarCuentaAsistente } from './api'

/** Configuración de con qué cuenta consulta el asistente.
 *
 * Cargar la propia API key es lo que cambia quién paga: con key propia, el
 * consumo lo factura Anthropic directamente al comercio. */
export function CuentaAsistente() {
  const { toast } = useToast()
  const { data: cuenta, isLoading } = useCuentaAsistente()
  const guardar = useGuardarCuentaAsistente()
  const [apiKey, setApiKey] = useState('')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Cargando…
      </div>
    )
  }
  if (!cuenta) return null

  const propia = cuenta.factura === 'comercio'

  async function guardarKey(e: FormEvent) {
    e.preventDefault()
    try {
      await guardar.mutateAsync({ api_key: apiKey })
      setApiKey('')
      toast(apiKey ? 'Cuenta propia configurada' : 'Volviste a la cuenta del servidor')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar la cuenta'), 'error')
    }
  }

  async function cambiarModelo(modelo: string) {
    try {
      await guardar.mutateAsync({ modelo })
      toast('Modelo actualizado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cambiar el modelo'), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          propia ? 'border-accent-2/40 bg-accent-2/5' : 'border-border bg-surface-2/50'
        }`}
      >
        <CreditCard size={17} className={propia ? 'mt-0.5 text-accent-2' : 'mt-0.5 text-text-dim'} />
        <div className="text-sm">
          {propia ? (
            <>
              <p className="font-medium text-text">El consumo lo facturás vos</p>
              <p className="mt-0.5 text-text-dim">
                Las consultas se cobran a tu cuenta de Anthropic (key {cuenta.key_enmascarada}).
                Podés elegir el modelo y no tenés tope de gasto más allá del límite diario
                de {cuenta.consultas_diarias} consultas.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-text">Estás usando la cuenta del proveedor del sistema</p>
              <p className="mt-0.5 text-text-dim">
                Las consultas las paga quien administra el sistema, con el modelo y el límite
                que él configuró. Cargá tu propia API key si querés facturarlo por tu cuenta
                y elegir el modelo.
              </p>
            </>
          )}
        </div>
      </div>

      <form onSubmit={guardarKey} className="flex flex-col gap-3">
        <Input
          id="anthropic-key"
          label={propia ? 'Reemplazar la API key' : 'Tu API key de Anthropic'}
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <p className="text-xs text-text-dim">
          Se saca de <span className="text-text">console.anthropic.com</span> → API Keys. Se guarda
          cifrada en el servidor y no se muestra nunca más. El navegador no la ve.
        </p>
        <div className="flex gap-2">
          <Button type="submit" disabled={guardar.isPending || !apiKey}>
            {guardar.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Guardar key
          </Button>
          {propia && (
            <Button
              type="button" variant="ghost" disabled={guardar.isPending}
              onClick={() => { setApiKey(''); guardar.mutateAsync({ api_key: '' }).catch(() => {}) }}
            >
              Quitar y volver a la cuenta del proveedor
            </Button>
          )}
        </div>
      </form>

      {propia && (
        <div className="border-t border-border pt-4">
          <Select
            id="modelo-asistente" label="Modelo"
            value={cuenta.modelo}
            onChange={(e) => cambiarModelo(e.target.value)}
            disabled={guardar.isPending}
            className="max-w-sm"
          >
            {cuenta.modelos_disponibles.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </Select>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-dim">
            <Sparkles size={12} className="text-accent" />
            {cuenta.modelos_disponibles.find((m) => m.id === cuenta.modelo)?.detalle}
          </p>
        </div>
      )}
    </div>
  )
}
