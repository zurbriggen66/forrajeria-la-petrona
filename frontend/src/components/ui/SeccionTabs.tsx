import { Link } from 'react-router-dom'

/** Pestañas de una sección. Son links reales (no botones con estado): así el
 * deep-link a una pestaña funciona, F5 no te devuelve a la primera, y el botón
 * "atrás" del navegador hace lo esperable.
 *
 * El activo llega por prop en vez de dejárselo a NavLink porque al entrar por
 * la ruta padre (ej. /caja) ninguna hija matchea y hay que marcar la primera. */
export function SeccionTabs({ items, activo }: {
  items: { label: string; path: string }[]
  activo: string
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {items.map((t) => {
        const esActivo = t.path === activo
        return (
          <Link
            key={t.path}
            to={t.path}
            className={`relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors ${
              esActivo ? 'text-accent' : 'text-text-dim hover:text-text'
            }`}
          >
            {t.label}
            {esActivo && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </Link>
        )
      })}
    </div>
  )
}
