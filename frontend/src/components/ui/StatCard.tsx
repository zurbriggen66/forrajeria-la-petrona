import type { ReactNode } from 'react'

export type StatVariant = 'total' | 'accent' | 'teal' | 'gold' | 'danger'

const VARIANTS: Record<StatVariant, string> = {
  total: 'bg-gradient-to-br from-[#141b28] to-[#05070a] text-text border border-border/70',
  accent: 'bg-gradient-to-br from-[#4fa3ff] to-[#0f5fd6] text-white',
  teal: 'bg-gradient-to-br from-[#28f0bc] to-[#00976e] text-[#00261b]',
  gold: 'bg-gradient-to-br from-[#ffd75e] to-[#d19a12] text-[#241a02]',
  danger: 'bg-gradient-to-br from-[#ff7a72] to-[#c22a24] text-[#2a0503]',
}

interface StatCardProps {
  label: string
  value: ReactNode
  variant?: StatVariant
}

export function StatCard({ label, value, variant = 'total' }: StatCardProps) {
  return (
    <div
      className={`flex flex-col justify-center gap-1 rounded-2xl p-4 shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl hover:scale-[1.02] ${VARIANTS[variant]}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
    </div>
  )
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
}
