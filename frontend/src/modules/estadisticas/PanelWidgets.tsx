import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

/** Tarjeta de KPI con badge de variación, al estilo del panel de referencia:
 * el número grande manda, el ícono y la tendencia acompañan sin competir. */
export function MetricCard({ label, value, hint, icon: Icon, variacion, tono = 'neutro' }: {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  variacion?: number | null
  /** Qué significa que el número suba: en egresos subir es malo. */
  tono?: 'neutro' | 'positivo' | 'inverso'
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
      <div className="mb-3 flex items-start justify-between">
        <span className="rounded-xl bg-surface-2 p-2 text-accent">
          <Icon size={16} />
        </span>
        {variacion !== undefined && <BadgeVariacion pct={variacion} tono={tono} />}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-dim">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
    </div>
  )
}

function BadgeVariacion({ pct, tono }: { pct: number | null; tono: 'neutro' | 'positivo' | 'inverso' }) {
  if (pct === null) {
    return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-text-dim">sin comparación</span>
  }
  const sube = pct > 0
  const Icono = pct === 0 ? Minus : sube ? TrendingUp : TrendingDown
  // En egresos, subir es malo: se invierte el color, no el ícono.
  const bueno = tono === 'inverso' ? !sube : sube
  const color = pct === 0
    ? 'bg-surface-2 text-text-dim'
    : bueno ? 'bg-accent-2/15 text-accent-2' : 'bg-danger/15 text-danger'
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${color}`}>
      <Icono size={11} />
      {sube ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

export function Card({ titulo, subtitulo, accion, children, className = '' }: {
  titulo: string
  subtitulo?: string
  accion?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-text">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-text-dim">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}

/** Lista de barras horizontales — para rankings donde importa la proporción
 * entre el primero y el resto más que el valor exacto. */
export function BarraRanking({ filas }: {
  filas: { nombre: string; valor: number; etiqueta: string; detalle?: string }[]
}) {
  const maximo = Math.max(...filas.map((f) => f.valor), 1)
  return (
    <div className="flex flex-col gap-3">
      {filas.map((f) => (
        <div key={f.nombre} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-text">{f.nombre}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-text">{f.etiqueta}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-brand transition-[width] duration-500"
              style={{ width: `${Math.max((f.valor / maximo) * 100, 2)}%` }}
            />
          </div>
          {f.detalle && <span className="text-[11px] text-text-dim">{f.detalle}</span>}
        </div>
      ))}
    </div>
  )
}

export function VacioChart({ mensaje }: { mensaje: string }) {
  return <p className="py-16 text-center text-sm text-text-dim">{mensaje}</p>
}
