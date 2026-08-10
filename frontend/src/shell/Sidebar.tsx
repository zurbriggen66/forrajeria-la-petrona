import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { NAV_ITEMS } from '../router/navigation'
import { useAuth } from '../context/AuthContext'
import { Brand } from '../components/Brand'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { logout } = useAuth()
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(NAV_ITEMS.filter((i) => i.children?.some((c) => location.pathname.startsWith(c.path))).map((i) => i.label)),
  )

  function toggleExpanded(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  return (
    <aside
      className={`flex h-svh flex-col border-r border-border bg-surface transition-[width] ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <div
        className={`flex items-center border-b border-border px-4 py-4 ${collapsed ? 'flex-col gap-3' : 'justify-between'}`}
      >
        <Brand compact={collapsed} />
        <button
          onClick={onToggle}
          className="rounded p-1 text-text-dim hover:bg-surface-2 hover:text-text"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active =
              location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            const isExpanded = expanded.has(item.label)

            return (
              <li key={item.label}>
                {item.children ? (
                  <button
                    onClick={() => toggleExpanded(item.label)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-gradient-to-r from-accent/15 to-transparent text-accent border-l-2 border-accent -ml-0.5 pl-[13px]' : 'border-l-2 border-transparent text-text-dim hover:bg-surface-2 hover:text-text'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          size={14}
                          className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </>
                    )}
                  </button>
                ) : (
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive ? 'bg-gradient-to-r from-accent/15 to-transparent text-accent border-l-2 border-accent -ml-0.5 pl-[13px]' : 'border-l-2 border-transparent text-text-dim hover:bg-surface-2 hover:text-text'
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                )}

                {item.children && isExpanded && !collapsed && (
                  <ul className="ml-8 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                    {item.children.map((child) => (
                      <li key={child.path}>
                        <NavLink
                          to={child.path}
                          className={({ isActive }) =>
                            `block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                              isActive ? 'text-accent' : 'text-text-dim hover:text-text'
                            }`
                          }
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className={`mb-2 flex items-center gap-2 text-xs text-accent ${collapsed ? 'justify-center' : ''}`}>
          <span className="h-2 w-2 rounded-full bg-accent" />
          {!collapsed && <span>Conectado</span>}
        </div>
        <button
          onClick={logout}
          className={`flex w-full items-center gap-2 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={16} />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  )
}
