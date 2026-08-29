import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { moduloBloqueado, NAV_ITEMS } from '../router/navigation'
import { useAuth } from '../context/AuthContext'
import { Brand } from '../components/Brand'

// Contraído: ícono arriba y etiqueta chiquita abajo (riel angosto).
// Expandido: ícono a la izquierda y etiqueta al lado, en cuerpo legible —
// mismo ítem, sólo cambia la disposición, así no hay dos listas que mantener.
// Cada variante va dos veces: `group-hover:` para el mouse y
// `group-[.barra-fija]:` para cuando quedó fijada con el botón. En una tablet
// no hay hover, así que sin la segunda el modo cómodo era inalcanzable.
const ITEM = [
  'flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2',
  'text-[10px] font-medium leading-tight transition-all',
  'group-hover:flex-row group-hover:gap-3 group-hover:px-3 group-hover:py-2.5 group-hover:text-sm',
  'group-[.barra-fija]:flex-row group-[.barra-fija]:gap-3 group-[.barra-fija]:px-3 group-[.barra-fija]:py-2.5 group-[.barra-fija]:text-sm',
].join(' ')
const ACTIVO = 'bg-gradient-brand text-accent-ink shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]'
const INACTIVO = 'text-text-dim hover:bg-surface-2 hover:text-text'

const CLAVE_FIJADA = 'sidebar-fijada'

/** Riel de íconos que se abre al pasar el mouse, o fijado con el botón.
 *
 * El botón no es un lujo: en una tablet —que es donde más sentido tiene un
 * POS de mostrador— no existe el hover, así que sin él la barra se quedaba
 * siempre angosta. La preferencia se recuerda entre sesiones.
 *
 * Se abre por ENCIMA del contenido, no empujándolo: el div de afuera queda
 * en el flujo reservando siempre el ancho contraído. Si la barra empujara,
 * cada vez que el mouse la roza se reacomodarían las tablas de al lado. */
export function Sidebar() {
  const { logout, user } = useAuth()
  // Los módulos que el Dueño le apagó a este empleado no se dibujan. El
  // servidor igual los rechaza (core/permissions.py::ModuloHabilitado): esto
  // es para que no vea puertas cerradas, no para trabarlas.
  const visibles = NAV_ITEMS.filter((i) => !moduloBloqueado(i.path, user?.modulos_bloqueados ?? []))
  const [fijada, setFijada] = useState(() => localStorage.getItem(CLAVE_FIJADA) === '1')

  useEffect(() => {
    localStorage.setItem(CLAVE_FIJADA, fijada ? '1' : '0')
  }, [fijada])

  return (
    <div className={`relative shrink-0 transition-[width] duration-200 ${fijada ? 'w-60' : 'w-20'}`}>
      <aside
        className={`group absolute inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-surface py-4 transition-[width] duration-200 ${
          fijada ? 'barra-fija w-60' : 'w-20 hover:w-60 hover:shadow-2xl'
        }`}
      >
        {/* Las dos marcas montadas a la vez y alternadas por CSS: que se
            abra y cierre no puede depender de estado de React (un re-render
            por cada roce del mouse en la barra de siempre). */}
        <div className="mb-2 flex justify-center px-2 group-hover:justify-start group-hover:px-3 group-[.barra-fija]:justify-start group-[.barra-fija]:px-3">
          <span className="group-hover:hidden group-[.barra-fija]:hidden"><Brand compact /></span>
          <span className="hidden group-hover:block group-[.barra-fija]:block"><Brand /></span>
        </div>

        <button
          onClick={() => setFijada((v) => !v)}
          aria-label={fijada ? 'Contraer la barra lateral' : 'Fijar la barra lateral abierta'}
          title={fijada ? 'Contraer' : 'Fijar abierta'}
          className="mx-2 mb-2 flex min-h-9 items-center justify-center gap-2 rounded-xl text-text-dim transition-colors hover:bg-surface-2 hover:text-text group-hover:justify-start group-hover:px-3 group-[.barra-fija]:justify-start group-[.barra-fija]:px-3"
        >
          {fijada ? <PanelLeftClose size={18} className="shrink-0" /> : <PanelLeftOpen size={18} className="shrink-0" />}
          <span className="hidden whitespace-nowrap text-sm group-hover:inline group-[.barra-fija]:inline">
            {fijada ? 'Contraer' : 'Fijar abierta'}
          </span>
        </button>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2">
          <ul className="flex flex-col gap-1">
            {visibles.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.label} className="w-full">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `${ITEM} ${isActive ? ACTIVO : INACTIVO}`}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span className="text-center group-hover:whitespace-nowrap group-hover:text-left group-[.barra-fija]:whitespace-nowrap group-[.barra-fija]:text-left">
                      {item.label}
                    </span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-2 border-t border-border px-2 pt-3">
          <div className="flex items-center justify-center gap-2 group-hover:justify-start group-hover:px-3 group-[.barra-fija]:justify-start group-[.barra-fija]:px-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" title="Conectado" />
            <span className="hidden whitespace-nowrap text-xs text-text-dim group-hover:inline group-[.barra-fija]:inline">Conectado</span>
          </div>
          <button
            onClick={logout}
            className="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-danger transition-all hover:bg-danger/10 group-hover:flex-row group-hover:gap-3 group-hover:px-3 group-hover:text-sm group-[.barra-fija]:flex-row group-[.barra-fija]:gap-3 group-[.barra-fija]:px-3 group-[.barra-fija]:text-sm"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="group-hover:whitespace-nowrap group-[.barra-fija]:whitespace-nowrap">Salir</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
