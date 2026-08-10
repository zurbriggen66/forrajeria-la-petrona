import { useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { FLAT_ROUTES, NAV_ITEMS } from '../router/navigation'
import { Button } from '../components/ui/Button'
import { useToast } from '../context/ToastContext'

export function Topbar() {
  const location = useLocation()
  const { toast } = useToast()

  const current =
    FLAT_ROUTES.find((r) => r.path === location.pathname) ??
    NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))

  const Icon = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))?.icon

  return (
    <header className="flex items-center justify-between border-b border-border bg-bg px-6 py-4">
      <h1 className="flex items-center gap-2 text-xl font-bold text-text">
        {Icon && <Icon size={20} className="text-accent" />}
        {current?.label ?? 'TIENDA-IA'}
      </h1>
      <Button variant="secondary" onClick={() => toast('Actualizado')}>
        <RefreshCw size={14} />
        Actualizar
      </Button>
    </header>
  )
}
