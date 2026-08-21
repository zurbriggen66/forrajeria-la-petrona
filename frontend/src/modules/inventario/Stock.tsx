import { useState } from 'react'
import { Store, Warehouse } from 'lucide-react'
import { Deposito } from './Deposito'
import { EstadoInventario } from './EstadoInventario'

type Vista = 'local' | 'depositos'

const TABS: { key: Vista; label: string; icon: typeof Store }[] = [
  { key: 'local', label: 'En el local', icon: Store },
  { key: 'depositos', label: 'Depósitos externos', icon: Warehouse },
]

/** Sección "Stock" del panel: junta lo que antes eran dos entradas separadas
 * (Inventario > Estado del inventario, y Depósito) en una sola, con el local
 * y los depósitos externos como dos vistas de la misma sección. */
export function Stock() {
  const [vista, setVista] = useState<Vista>('local')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setVista(t.key)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              vista === t.key ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {vista === 'local' ? <EstadoInventario /> : <Deposito />}
    </div>
  )
}
