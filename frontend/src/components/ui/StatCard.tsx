import type { ReactNode } from 'react'
import { Privado } from './Privado'

export type StatVariant = 'total' | 'accent' | 'teal' | 'gold' | 'danger'

// La variante ya no pinta la tarjeta entera: todas son negras y sólo cambia
// el color del número. Cinco bloques de color saturado en fila competían
// entre sí y ninguno destacaba.
const VARIANTS: Record<StatVariant, string> = {
  total: 'text-text',
  accent: 'text-accent',
  teal: 'text-accent-2',
  gold: 'text-warning',
  danger: 'text-danger',
}

interface StatCardProps {
  label: string
  value: ReactNode
  variant?: StatVariant
}

export function StatCard({ label, value, variant = 'total' }: StatCardProps) {
  return (
    <div
      className="flex flex-col justify-center gap-1 rounded-2xl border border-border bg-surface p-4 shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl hover:scale-[1.02]"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">{label}</span>
      <span className={`font-display text-2xl font-bold tabular-nums ${VARIANTS[variant]}`}>
        <Privado>{value}</Privado>
      </span>
    </div>
  )
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
}
