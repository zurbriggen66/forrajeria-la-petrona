import type { ReactNode } from 'react'

export type StatVariant = 'total' | 'accent' | 'teal' | 'gold' | 'danger'

const VARIANTS: Record<StatVariant, string> = {
  total: 'bg-gradient-to-br from-[#2c261c] to-[#171310] text-text border border-border/70',
  accent: 'bg-gradient-to-br from-[#e69248] to-[#b5601a] text-accent-ink',
  teal: 'bg-gradient-to-br from-[#57c7a6] to-[#2c7d68] text-[#052018]',
  gold: 'bg-gradient-to-br from-[#f4cf5c] to-[#c99a1e] text-[#231a02]',
  danger: 'bg-gradient-to-br from-[#f2837c] to-[#c23a35] text-[#2a0503]',
}

interface StatCardProps {
  label: string
  value: ReactNode
  variant?: StatVariant
}

export function StatCard({ label, value, variant = 'total' }: StatCardProps) {
  return (
    <div
      className={`flex flex-col justify-center gap-1 rounded-2xl p-4 shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl ${VARIANTS[variant]}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
    </div>
  )
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
}
