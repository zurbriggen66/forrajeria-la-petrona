import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Loader2, Send, Sparkles, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useConfirmarAccion, useConsultarAsistente, useCuotaAsistente } from './api'
import type { AccionPendiente, Burbuja, Cuota, TurnoApi } from './types'

const SUGERENCIAS = [
  '¿Cuánto vendí hoy?',
  '¿Qué productos me quedan sin stock?',
  '¿Qué es lo que más vendo esta semana?',
  '¿Cuánto me debe...?',
]

const TITULO_ACCION: Record<AccionPendiente['tipo'], string> = {
  alta_producto: 'Cargar este producto',
  venta: 'Registrar esta venta',
}

function id() {
  return crypto.randomUUID()
}

/** Tarjeta de confirmación: el asistente propone, esto lo ejecuta.
 * Nada que el asistente prepare se escribe hasta que se apreta acá. */
function TarjetaAccion({ accion, onResuelta }: { accion: AccionPendiente; onResuelta: (texto: string) => void }) {
  const { toast } = useToast()
  const confirmar = useConfirmarAccion()
  const [resuelta, setResuelta] = useState<string | null>(null)

  async function decidir(aceptar: boolean) {
    try {
      const data = await confirmar.mutateAsync({ accion: accion.id, confirmar: aceptar })
      setResuelta(data.mensaje)
      onResuelta(data.mensaje)
      toast(data.mensaje)
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo completar la acción'), 'error')
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-accent">
        <AlertTriangle size={13} /> {TITULO_ACCION[accion.tipo]}
      </div>
      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text">{accion.resumen}</pre>

      {resuelta ? (
        <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-accent-2">
          <Check size={13} /> {resuelta}
        </p>
      ) : (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <Button onClick={() => decidir(true)} disabled={confirmar.isPending} className="!py-1.5 text-xs">
            {confirmar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Confirmar
          </Button>
          <Button variant="ghost" onClick={() => decidir(false)} disabled={confirmar.isPending} className="!py-1.5 text-xs">
            <X size={13} /> Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}

/** Cuántas consultas quedan hoy. Se muestra siempre para que el uso del
 * asistente no sea una sorpresa a fin de mes. */
function ContadorCuota({ cuota }: { cuota: Cuota }) {
  if (!cuota.habilitado) return null
  const agotado = cuota.restantes_hoy === 0
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs tabular-nums ${
        agotado ? 'border-warning/40 bg-warning/10 text-warning' : 'border-border text-text-dim'
      }`}
    >
      {agotado
        ? 'Sin consultas por hoy'
        : `${cuota.restantes_hoy} de ${cuota.limite_diario} consultas hoy`}
    </span>
  )
}

export function Asistente() {
  const { toast } = useToast()
  const consultar = useConsultarAsistente()
  const { data: cuotaInicial } = useCuotaAsistente()
  const [cuota, setCuota] = useState<Cuota | null>(null)
  const [burbujas, setBurbujas] = useState<Burbuja[]>([])
  // El historial que entiende la API va aparte de lo que se muestra: la API
  // necesita los turnos de herramientas, la pantalla sólo el texto.
  const [historial, setHistorial] = useState<TurnoApi[]>([])
  const [texto, setTexto] = useState('')
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [burbujas, consultar.isPending])

  async function preguntar(mensaje: string) {
    const limpio = mensaje.trim()
    if (!limpio || consultar.isPending) return

    setBurbujas((prev) => [...prev, { id: id(), autor: 'usuario', texto: limpio }])
    setTexto('')

    try {
      const data = await consultar.mutateAsync({ mensaje: limpio, historial })
      setHistorial(data.historial)
      setCuota(data.cuota)
      setBurbujas((prev) => [
        ...prev,
        { id: id(), autor: 'asistente', texto: data.respuesta, accion: data.accion_pendiente ?? undefined },
      ])
    } catch (err) {
      const detalle = extraerMensajeError(err, 'No pude responder. Probá de nuevo.')
      setBurbujas((prev) => [...prev, { id: id(), autor: 'asistente', texto: detalle }])
      toast(detalle, 'error')
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    preguntar(texto)
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <div className="flex-1 overflow-y-auto">
        {burbujas.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="rounded-full bg-accent/10 p-4 text-accent">
              <Sparkles size={26} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-text">Preguntame sobre tu negocio</p>
              <p className="mt-1 text-sm text-text-dim">
                Puedo mirar tus ventas, tu stock y las cuentas de tus clientes.
                También preparo un producto o una venta para que la confirmes vos.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => preguntar(s)}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-dim transition-colors hover:border-accent/50 hover:text-text"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {burbujas.map((b) => (
              <div key={b.id} className={b.autor === 'usuario' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    b.autor === 'usuario'
                      ? 'bg-accent/15 text-text'
                      : 'border border-border bg-surface text-text'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{b.texto}</p>
                  {b.accion && (
                    <TarjetaAccion
                      accion={b.accion}
                      onResuelta={(mensaje) =>
                        setHistorial((prev) => [
                          ...prev,
                          { role: 'user', content: `[el usuario resolvió la acción: ${mensaje}]` },
                        ])
                      }
                    />
                  )}
                </div>
              </div>
            ))}
            {consultar.isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-text-dim">
                  <Loader2 size={14} className="animate-spin" /> Mirando tus datos…
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border pt-4">
        {(cuota ?? cuotaInicial) && (
          <div className="flex justify-end">
            <ContadorCuota cuota={(cuota ?? cuotaInicial)!} />
          </div>
        )}
        <div className="flex items-center gap-2">
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí tu pregunta…"
          className="flex-1 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button type="submit" disabled={!texto.trim() || consultar.isPending} className="!px-4 !py-3">
          {consultar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
        </div>
      </form>
    </div>
  )
}
