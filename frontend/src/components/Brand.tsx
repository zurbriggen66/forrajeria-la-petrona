import { Sparkles } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="glow-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-accent-ink">
        <Sparkles size={15} strokeWidth={2.5} />
      </span>
      {!compact && (
        <span className="font-display flex items-baseline gap-1.5 text-lg font-bold leading-none">
          <span className="text-text">TIENDA</span>
          <span className="text-gradient-brand">IA</span>
        </span>
      )}
    </div>
  )
}
