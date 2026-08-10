import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string
  subtitle?: string
  trend?: { value: string; positive: boolean }
  icon?: LucideIcon
  accent?: 'accent' | 'accent-2' | 'warning' | 'danger'
}

const ACCENT_ICON_BG: Record<NonNullable<KpiCardProps['accent']>, string> = {
  accent: 'bg-accent/15 text-accent',
  'accent-2': 'bg-accent-2/15 text-accent-2',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
}

export function KpiCard({ label, value, subtitle, trend, icon: Icon, accent = 'accent' }: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-shadow hover:glow-accent">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-brand opacity-0 blur-2xl transition-opacity group-hover:opacity-20" />
      <div className="relative flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-text-dim">{label}</span>
        {Icon && (
          <span className={`rounded-lg p-1.5 ${ACCENT_ICON_BG[accent]}`}>
            <Icon size={14} />
          </span>
        )}
      </div>
      <div className="relative mt-2 font-display text-2xl font-semibold tabular-nums text-text">{value}</div>
      {(subtitle || trend) && (
        <div className="relative mt-1 flex items-center gap-2 text-xs text-text-dim">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span className={trend.positive ? 'text-accent-2' : 'text-danger'}>
              {trend.positive ? '+' : ''}
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
