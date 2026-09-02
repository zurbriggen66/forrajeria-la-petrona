import { AlertTriangle, Clock, Loader2, TrendingUp, UserCheck, Users, Wallet } from 'lucide-react'
import { KpiCard } from '../../components/ui/KpiCard'
import { Privado } from '../../components/ui/Privado'
import { formatMoney, parseDecimal } from '../../lib/format'
import { useEstadisticasClientes } from './api'
import type { ClienteRanking } from './types'

function formatFechaSola(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function diasDesde(iso: string | null) {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  return Math.floor((Date.now() - new Date(a, m - 1, d).getTime()) / 86_400_000)
}

/** Ranking con barra proporcional al primero.
 *
 * La barra es el punto: una columna de números ordenados no dice si el primero
 * duplica al segundo o le gana por dos pesos, y eso es justo lo que se quiere
 * ver de un vistazo. Se dibuja con un div y un ancho en % — no hace falta una
 * librería de gráficos para cinco barras.
 */
function Ranking({ titulo, ayuda, filas, color, valor, detalle, vacio }: {
  titulo: string
  ayuda: string
  filas: ClienteRanking[]
  color: string
  valor: (f: ClienteRanking) => string
  detalle: (f: ClienteRanking) => string
  vacio: string
}) {
  const maximo = Math.max(...filas.map((f) => parseDecimal(f.total)), 1)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-text">{titulo}</h3>
        <p className="text-xs text-text-dim">{ayuda}</p>
      </div>

      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-dim">{vacio}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filas.map((fila) => (
            <div key={fila.cliente} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-text">{fila.nombre}</span>
                <span className="shrink-0 tabular-nums font-medium text-text"><Privado>{valor(fila)}</Privado></span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${Math.max((parseDecimal(fila.total) / maximo) * 100, 2)}%` }}
                />
              </div>
              <p className="text-xs text-text-dim"><Privado>{detalle(fila)}</Privado></p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Los números de la cartera de clientes. */
export function EstadisticasClientes() {
  const { data, isLoading } = useEstadisticasClientes()

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Cargando las estadísticas…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Clientes activos" value={String(data.clientes)} icon={Users}
          subtitle={`${data.clientes_que_compraron} compraron alguna vez`}
        />
        <KpiCard
          label="Me deben" value={formatMoney(data.total_por_cobrar)} icon={Wallet} accent="danger"
          subtitle={`${data.con_deuda} cliente${data.con_deuda === 1 ? '' : 's'} con saldo`}
        />
        <KpiCard
          label="Tienen a favor" value={formatMoney(data.total_a_favor)} icon={UserCheck} accent="accent-2"
          subtitle={`${data.con_saldo_a_favor} pagaron de más`}
        />
        <KpiCard
          label="Ticket promedio" value={formatMoney(data.ticket_promedio)} icon={TrendingUp}
          subtitle={`${formatMoney(data.facturado_a_clientes)} facturado`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Ranking
          titulo="Los que más compran"
          ayuda="Sin contar las ventas anuladas."
          filas={data.top_compradores}
          color="bg-accent"
          valor={(f) => formatMoney(f.total)}
          detalle={(f) => `${f.cantidad} compra${f.cantidad === 1 ? '' : 's'} · promedio ${formatMoney(f.ticket_promedio)} · última ${formatFechaSola(f.ultima_compra)}`}
          vacio="Todavía no hay ventas a clientes con ficha."
        />

        <Ranking
          titulo="Los que más deben"
          ayuda="Ordenados por saldo, con aviso si pasaron su límite."
          filas={data.mayores_deudores.map((d) => ({
            cliente: d.cliente, nombre: d.nombre, total: d.saldo,
            cantidad: 0, ticket_promedio: '0', ultima_compra: null,
          }))}
          color="bg-danger"
          valor={(f) => formatMoney(f.total)}
          detalle={(f) => {
            const deudor = data.mayores_deudores.find((d) => d.cliente === f.cliente)
            if (!deudor) return ''
            if (parseDecimal(deudor.limite_credito) <= 0) return 'sin límite de crédito cargado'
            return deudor.paso_el_limite
              ? `⚠ pasó su límite de ${formatMoney(deudor.limite_credito)}`
              : `límite ${formatMoney(deudor.limite_credito)}`
          }}
          vacio="Nadie te debe plata."
        />

        {/* El número comercial que nadie mira: clientes que compraban y
            dejaron de venir. Es a quién llamar. */}
        <Ranking
          titulo="Dejaron de venir"
          ayuda={`Compraban y hace más de ${data.dias_dormido} días que no aparecen.`}
          filas={data.dormidos}
          color="bg-warning"
          valor={(f) => formatMoney(f.total)}
          detalle={(f) => {
            const dias = diasDesde(f.ultima_compra)
            return `${f.cantidad} compra${f.cantidad === 1 ? '' : 's'} · última hace ${dias ?? '—'} días`
          }}
          vacio="Ninguno: todos tus clientes vinieron hace poco."
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-text-dim">
        <Clock size={12} />
        Las ventas anuladas no cuentan en ningún número de esta pantalla.
        <AlertTriangle size={12} className="ml-2 text-warning" />
        El saldo a favor se muestra en positivo: es plata del cliente, no una deuda tuya en rojo.
      </p>
    </div>
  )
}
