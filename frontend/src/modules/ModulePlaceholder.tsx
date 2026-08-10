import { Sparkles } from 'lucide-react'

/**
 * Placeholder de un módulo todavía no implementado. Se reemplaza módulo a
 * módulo según ROADMAP.md.
 */
export function ModulePlaceholder({ nombre }: { nombre: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full bg-gradient-brand [animation-duration:2.5s] [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-3px))]" />
        <Sparkles size={18} className="text-accent" />
      </div>
      <p className="text-sm font-medium text-text-dim">Cargando módulo…</p>
      <p className="text-xs text-text-dim/60">{nombre} — todavía no implementado (ver ROADMAP.md)</p>
    </div>
  )
}
