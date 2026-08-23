import { useState } from 'react'
import { usePedidosManuales, usePedidosSugeridos } from '../proveedores/api'
import { PedidosManuales } from '../proveedores/PedidosManuales'
import { PedidosSugeridos } from '../proveedores/PedidosSugeridos'
import { StatCard, StatRow } from '../../components/ui/StatCard'

const SUBTABS = [
  { key: 'sugeridos', label: 'Sugeridos' },
  { key: 'manuales', label: 'Manuales' },
] as const

type SubtabKey = (typeof SUBTABS)[number]['key']

export function PedidosProveedorTab() {
  const [subtab, setSubtab] = useState<SubtabKey>('sugeridos')
  const { data: sugeridos } = usePedidosSugeridos()
  const { data: manuales } = usePedidosManuales()

  const pendientes = (manuales ?? []).filter((p) => p.estado === 'pendiente').length
  const enCamino = (manuales ?? []).filter((p) => p.estado === 'enviado').length

  return (
    <div className="flex flex-col gap-4">
      <StatRow>
        <StatCard label="Por debajo del mínimo" value={sugeridos?.length ?? 0} variant="danger" />
        <StatCard label="Pedidos pendientes" value={pendientes} variant="accent" />
        <StatCard label="En camino" value={enCamino} variant="teal" />
        <StatCard label="Total de pedidos" value={manuales?.length ?? 0} variant="total" />
      </StatRow>

      <div className="flex w-fit gap-1 rounded-lg bg-surface-2 p-1">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubtab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              subtab === t.key ? 'bg-accent/15 text-accent' : 'text-text-dim hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === 'sugeridos' ? <PedidosSugeridos /> : <PedidosManuales />}
    </div>
  )
}
