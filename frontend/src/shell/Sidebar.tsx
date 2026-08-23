import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { NAV_ITEMS } from '../router/navigation'
import { useAuth } from '../context/AuthContext'
import { Brand } from '../components/Brand'

const ITEM = 'flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight transition-colors'
const ACTIVO = 'bg-gradient-brand text-accent-ink shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]'
const INACTIVO = 'text-text-dim hover:bg-surface-2 hover:text-text'

/** Riel de íconos. Todo ítem navega directo a su sección — las que agrupan
 * varias pantallas las muestran como pestañas adentro (ver SeccionPage), en
 * vez del menú flotante que había antes. */
export function Sidebar() {
  const { logout } = useAuth()

  return (
    <aside className="flex h-svh w-20 shrink-0 flex-col items-center border-r border-border bg-surface py-4">
      <div className="mb-4">
        <Brand compact />
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="flex flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.label} className="w-full">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `${ITEM} ${isActive ? ACTIVO : INACTIVO}`}
                >
                  <Icon size={20} className="shrink-0" />
                  <span className="text-center">{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex flex-col items-center gap-2 border-t border-border pt-3">
        <span className="h-2 w-2 rounded-full bg-accent" title="Conectado" />
        <button
          onClick={logout}
          className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </div>
    </aside>
  )
}
