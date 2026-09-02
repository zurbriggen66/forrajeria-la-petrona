import { useLocation } from 'react-router-dom'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { FLAT_ROUTES, NAV_ITEMS } from '../router/navigation'
import { Button } from '../components/ui/Button'
import { usePrivacidad } from '../context/PrivacidadContext'
import { useToast } from '../context/ToastContext'
import { SucursalSwitcher } from './SucursalSwitcher'

export function Topbar() {
  const location = useLocation()
  const { toast } = useToast()
  const { oculto, alternar } = usePrivacidad()

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
      <div className="flex items-center gap-3">
        <SucursalSwitcher />
        {/* Para cuando hay un cliente del otro lado del mostrador: tapa la
            plata de todas las tarjetas sin sacar la pantalla del medio. */}
        <Button
          variant="secondary"
          onClick={alternar}
          title={oculto ? 'Volver a mostrar los números' : 'Tapar los números que están a la vista'}
        >
          {oculto ? <EyeOff size={14} /> : <Eye size={14} />}
          {oculto ? 'Oculto' : 'Ocultar'}
        </Button>
        <Button variant="secondary" onClick={() => toast('Actualizado')}>
          <RefreshCw size={14} />
          Actualizar
        </Button>
      </div>
    </header>
  )
}
