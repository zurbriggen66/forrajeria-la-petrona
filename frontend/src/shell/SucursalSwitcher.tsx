import { ChevronDown, Store } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

/** Selector de sucursal activa, visible arriba de todo en vez de escondido
 * como texto chico en el pie de página — con un solo local no hay nada para
 * elegir, así que se muestra sólo el nombre. */
export function SucursalSwitcher() {
  const { comercio, comercios, setComercioActivo } = useAuth()
  const { toast } = useToast()

  if (!comercio) return null

  if (comercios.length < 2) {
    return (
      <span className="flex items-center gap-2 text-sm text-text-dim">
        <Store size={15} className="text-accent" /> {comercio.nombre}
      </span>
    )
  }

  function elegir(id: string) {
    const elegida = comercios.find((c) => c.id === id)
    setComercioActivo(id)
    if (elegida) toast(`Ahora estás operando ${elegida.nombre}`)
  }

  return (
    <div className="relative">
      <Store size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
      <select
        value={comercio.id}
        onChange={(e) => elegir(e.target.value)}
        className="appearance-none rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-8 text-sm font-medium text-text transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {comercios.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-dim" />
    </div>
  )
}
