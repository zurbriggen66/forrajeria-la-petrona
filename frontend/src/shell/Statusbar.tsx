import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { FLAT_ROUTES, NAV_ITEMS } from '../router/navigation'
import { useAuth } from '../context/AuthContext'

export function Statusbar() {
  const location = useLocation()
  const { user, comercio } = useAuth()
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
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-text-dim" />
          CAJA CERRADA
        </span>
      </div>
      <div className="flex items-center gap-4">
        {comercio && <span>{comercio.nombre}</span>}
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
