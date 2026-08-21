import { Receipt, TrendingUp, Wallet } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { useResumen } from '../estadisticas/api'

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Metrica({ icon: Icon, label, value, acento }: {
  icon: typeof Wallet
  label: string
  value: string
  acento?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <span className={`rounded-lg p-1.5 ${acento ? 'bg-accent-2/15 text-accent-2' : 'bg-surface-2 text-text-dim'}`}>
        <Icon size={14} />
      </span>
      <div className="leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-dim">{label}</div>
        <div className={`font-display text-base font-semibold tabular-nums ${acento ? 'text-accent-2' : 'text-text'}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

/** Pulso del día sin salir del POS — una sola franja fina en vez de tres
 * tarjetas: en el punto de venta el espacio vertical se lo tienen que llevar
 * los productos y el carrito, no los números. Reusa el mismo endpoint que el
 * Panel de Estadísticas, filtrado a hoy; PosPage lo invalida tras cada venta. */
export function PosStats() {
  const { data, isLoading } = useResumen({ fecha_desde: hoyISO(), fecha_hasta: hoyISO() })
  const v = (valor: string) => (isLoading ? '…' : valor)

  return (
    <div className="flex flex-wrap items-center divide-x divide-border rounded-xl border border-border bg-surface">
      <Metrica icon={TrendingUp} label="Ventas de hoy" value={v(formatMoney(data?.ingresos ?? 0))} acento />
      <Metrica icon={Receipt} label="Tickets" value={v(String(data?.cantidad_ventas ?? 0))} />
      <Metrica icon={Wallet} label="Ticket promedio" value={v(formatMoney(data?.ticket_promedio ?? 0))} />
    </div>
  )
}
