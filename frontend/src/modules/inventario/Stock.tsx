import { useState } from 'react'
import { Store, Warehouse } from 'lucide-react'
import { useComercioConfig, useUpdateComercioConfig } from '../config/api'
import { Deposito } from './Deposito'
import { EstadoInventario } from './EstadoInventario'

type Vista = 'local' | 'depositos'

const TABS: { key: Vista; label: string; icon: typeof Store }[] = [
  { key: 'local', label: 'En el local', icon: Store },
  { key: 'depositos', label: 'Depósitos externos', icon: Warehouse },
]

/** Si un producto tiene el stock mal cargado (en 0 o de menos), lo normal acá
 * es que sea un dato pendiente de corregir, no que no haya mercadería. Este
 * toggle decide si eso frena la venta o no. */
function PermitirVentaSinStock() {
  const { data: config } = useComercioConfig()
  const { mutate, isPending } = useUpdateComercioConfig()

  if (!config) return null

  return (
    <label className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text">
      <input
        type="checkbox" className="mt-0.5 accent-accent" disabled={isPending}
        checked={config.permitir_venta_sin_stock}
        onChange={(e) => mutate({ permitir_venta_sin_stock: e.target.checked })}
      />
      <span>
        Permitir vender con stock en 0 o insuficiente
        <span className="mt-0.5 block text-xs text-text-dim">
          Recomendado si el stock cargado no es confiable todavía: la venta no se frena, y el
          stock queda en negativo como aviso de que ese producto necesita un recuento.
        </span>
      </span>
    </label>
  )
}

/** Sección "Stock" del panel: junta lo que antes eran dos entradas separadas
 * (Inventario > Estado del inventario, y Depósito) en una sola, con el local
 * y los depósitos externos como dos vistas de la misma sección. */
export function Stock() {
  const [vista, setVista] = useState<Vista>('local')

  return (
    <div className="flex flex-col gap-5">
      <PermitirVentaSinStock />

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
