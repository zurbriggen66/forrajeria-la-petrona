import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { FLAT_ROUTES, NAV_ITEMS } from '../router/navigation'
import { useAuth } from '../context/AuthContext'
import { useCajaActual } from '../modules/caja/api'

export function Statusbar() {
  const location = useLocation()
  const { user, comercio, comercios, setComercioActivo } = useAuth()
  const { data: cajaActual } = useCajaActual()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const current =
    FLAT_ROUTES.find((r) => r.path === location.pathname) ??
    NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))

  return (
    <footer className="flex items-center justify-between border-t border-border bg-surface px-6 py-2 text-xs text-text-dim">
      <div className="flex items-center gap-4">
        <span>{current?.label ?? '—'}</span>
        <Link
          to={cajaActual ? '/caja/contenedores' : '/caja/movimientos'}
          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors ${
            cajaActual ? 'border-accent-2/40 text-accent-2' : 'border-border hover:border-warning/40 hover:text-warning'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cajaActual ? 'bg-accent-2' : 'bg-text-dim'}`} />
          {cajaActual ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {comercios.length > 1 ? (
          <select
            value={comercio?.id ?? ''}
            onChange={(e) => setComercioActivo(e.target.value)}
            className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-text focus:border-accent focus:outline-none"
          >
            {comercios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        ) : (
          comercio && <span>{comercio.nombre}</span>
        )}
        <span>
          {user?.nombre_completo} · {user?.rol}
        </span>
        <span className={`flex items-center gap-1.5 ${online ? 'text-accent' : 'text-danger'}`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? 'Conectado' : 'Sin conexión'}
        </span>
      </div>
    </footer>
  )
}
