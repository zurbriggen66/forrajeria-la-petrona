import { useState } from 'react'
import { ArrowRight, History, Loader2, Pencil, Trash2 } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { useAuditoriaCuentaCorriente } from './api'
import type { MovimientoAuditoria } from './types'

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Cuánto se muestra sin pedirlo: la semana, que es la ventana con la que se
 * trabaja. Lo de antes no se borra — se pide con el botón. */
const DIAS_ATRAS_COMPLETO = 3650

function Fila({ registro }: { registro: MovimientoAuditoria }) {
  const eliminado = registro.accion === 'eliminado'
  const Icono = eliminado ? Trash2 : Pencil
  return (
    <div className={`flex flex-col gap-1 rounded-lg border p-2.5 text-sm ${
      eliminado ? 'border-danger/40 bg-danger/5' : 'border-border bg-surface-2/50'
    }`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${
          eliminado ? 'text-danger' : 'text-text-dim'
        }`}>
          <Icono size={12} />
          {eliminado ? 'Borrado' : 'Corregido'}
          <span className="font-normal normal-case tracking-normal text-text-dim">
            · {registro.tipo}
          </span>
        </span>
        <span className="text-xs text-text-dim">
          {formatFechaHora(registro.created_at)}
          {registro.hecho_por_nombre && ` · ${registro.hecho_por_nombre}`}
        </span>
      </div>

      <p className="text-text">“{registro.motivo}”</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-dim">
        <span className="flex items-center gap-1.5">
          Monto
          <span className="tabular-nums line-through">{formatMoney(registro.monto_anterior)}</span>
          {registro.monto_nuevo !== null && (
            <>
              <ArrowRight size={11} />
              <span className="tabular-nums text-text">{formatMoney(registro.monto_nuevo)}</span>
            </>
          )}
        </span>
        {/* El saldo antes y después es el número por el que se pregunta cuando
            hay que reconstruir qué pasó con la cuenta. */}
        <span className="flex items-center gap-1.5">
          Saldo
          <span className="tabular-nums">{formatMoney(registro.saldo_anterior)}</span>
          <ArrowRight size={11} />
          <span className="tabular-nums text-text">{formatMoney(registro.saldo_nuevo)}</span>
        </span>
        {registro.referencia_anterior && (
          <span className="truncate">Ref. {registro.referencia_anterior}</span>
        )}
      </div>
    </div>
  )
}

/** Qué se editó o se borró en la cuenta corriente, con el motivo y quién.
 *
 * Muestra la última semana. Lo más viejo NO se borra: sigue en la base y se
 * puede pedir acá con "Ver todo". Para sacarlo de la base hay un comando
 * aparte que primero lo exporta a un archivo (clientes_auditoria_archivar).
 *
 * `clienteId` filtra por un cliente; sin él, el registro de todo el comercio. */
export function RegistroCambios({ clienteId }: { clienteId?: string }) {
  const [verTodo, setVerTodo] = useState(false)
  const desde = verTodo
    ? new Date(Date.now() - DIAS_ATRAS_COMPLETO * 86_400_000).toISOString().slice(0, 10)
    : undefined
  const { data, isLoading } = useAuditoriaCuentaCorriente(clienteId, desde)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-text-dim">
        <Loader2 size={14} className="animate-spin" /> Cargando el registro…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-text-dim">
          <History size={12} />
          {verTodo ? 'Todo el historial de cambios' : 'Cambios de la última semana'}
        </p>
        <button
          type="button" onClick={() => setVerTodo((v) => !v)}
          className="text-xs text-text-dim hover:text-accent"
        >
          {verTodo ? 'Ver sólo la semana' : 'Ver todo'}
        </button>
      </div>

      {(data ?? []).length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-2/40 px-3 py-4 text-center text-sm text-text-dim">
          {verTodo
            ? 'Nunca se editó ni se borró un movimiento de esta cuenta.'
            : 'Ningún movimiento editado ni borrado esta semana.'}
        </p>
      ) : (
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {data!.map((registro) => <Fila key={registro.id} registro={registro} />)}
        </div>
      )}
    </div>
  )
}
