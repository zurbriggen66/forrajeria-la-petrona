import { useState } from 'react'
import {
  Loader2, Package, Percent, Receipt, ShoppingCart, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, ComposedChart, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatFechaSola, formatMoney, formatPct } from '../../lib/format'
import { FiltrosBar } from '../ventas/FiltrosBar'
import type { VentasFiltros } from '../ventas/types'
import { usePanel } from './api'
import { BarraRanking, Card, MetricCard, VacioChart } from './PanelWidgets'
import { EJE_PROPS, TOOLTIP_PROPS, montoCorto } from './chart'
import type { Actividad } from './types'

/** Paleta del donut de medios de pago. Arranca en el acento de la marca y se
 * abre a los secundarios; el resto cae en el gris del tema. */
const COLORES_METODO = [
  'var(--color-accent)', 'var(--color-accent-2)', 'var(--color-warning)',
  '#7c6cf0', 'var(--color-text-dim)',
]

function diaCorto(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

const ICONO_ACTIVIDAD = {
  venta: ShoppingCart,
  gasto: Receipt,
  pago_proveedor: Package,
} as const

function FilaActividad({ evento }: { evento: Actividad }) {
  const Icono = ICONO_ACTIVIDAD[evento.tipo] ?? Receipt
  const entra = evento.signo > 0
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
      <span className={`shrink-0 rounded-lg p-2 ${entra ? 'bg-accent-2/15 text-accent-2' : 'bg-danger/15 text-danger'}`}>
        <Icono size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{evento.descripcion}</p>
        {evento.detalle && <p className="truncate text-xs text-text-dim">{evento.detalle}</p>}
      </div>
      <span className="shrink-0 text-xs text-text-dim">{formatFechaSola(evento.fecha)}</span>
      <span className={`w-28 shrink-0 text-right text-sm font-medium tabular-nums ${entra ? 'text-accent-2' : 'text-danger'}`}>
        {entra ? '+' : '−'}{formatMoney(evento.monto)}
      </span>
    </div>
  )
}

export function Panel() {
  const [filtros, setFiltros] = useState<VentasFiltros>({})
  const { data, isLoading } = usePanel(filtros)

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-5">
        <FiltrosBar value={filtros} onChange={setFiltros} />
        <div className="flex items-center justify-center gap-2 py-24 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Calculando…
        </div>
      </div>
    )
  }

  const { kpis, periodo } = data
  const serie = data.serie.map((d) => ({
    dia: diaCorto(d.fecha),
    Ingresos: Number(d.ingresos),
    Egresos: Number(d.egresos),
    Ventas: d.cantidad_ventas,
    'Ticket promedio': Number(d.ticket_promedio),
  }))
  const huboMovimiento = serie.some((d) => d.Ingresos > 0 || d.Egresos > 0)
  const huboVentas = serie.some((d) => d.Ventas > 0)
  const metodos = data.metodos_pago.map((m) => ({ name: m.metodo, value: Number(m.monto), pct: m.pct }))
  const horas = data.por_hora.map((h) => ({ hora: `${h.hora}h`, ingresos: Number(h.ingresos) }))

  return (
    <div className="flex flex-col gap-5">
      <FiltrosBar value={filtros} onChange={setFiltros} />

      <p className="-mt-1 text-xs text-text-dim">
        Período analizado: {formatFechaSola(periodo.desde)} — {formatFechaSola(periodo.hasta)}.
        Las variaciones comparan contra el período anterior del mismo largo.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          label="Ingresos" value={formatMoney(kpis.ingresos)} icon={TrendingUp}
          variacion={kpis.var_ingresos_pct} tono="positivo"
          hint="Todo lo vendido, incluso lo fiado"
        />
        <MetricCard
          label="Cantidad de ventas" value={String(kpis.cantidad_ventas)} icon={ShoppingCart}
          variacion={kpis.var_cantidad_pct} tono="positivo"
        />
        <MetricCard
          label="Ticket promedio" value={formatMoney(kpis.ticket_promedio)} icon={Receipt}
          hint="Ingresos ÷ cantidad de ventas del período"
        />
        <MetricCard
          label="Egresos" value={formatMoney(kpis.egresos)} icon={TrendingDown}
          variacion={kpis.var_egresos_pct} tono="inverso"
          hint="Gastos + pagos a proveedor"
        />
        <MetricCard
          label="Balance" value={formatMoney(kpis.balance)} icon={Wallet}
          variacion={kpis.var_balance_pct} tono="positivo"
          hint="Ingresos − egresos. No es la plata en caja"
        />
        <MetricCard
          label="Margen sobre lo vendido" value={formatPct(kpis.margen_pct)} icon={Percent}
          hint="Sobre lo cobrado, ya con descuentos y recargos"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card
          titulo="Ingresos vs Egresos"
          subtitulo="Cuánto entró y cuánto salió, día por día"
        >
          {huboMovimiento ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dia" {...EJE_PROPS} minTickGap={24} />
                  <YAxis {...EJE_PROPS} width={58} tickFormatter={montoCorto} />
                  <Tooltip
                    {...TOOLTIP_PROPS}
                    formatter={(v) => formatMoney(Number(v) || 0)}
                  />
                  <Area
                    type="monotone" dataKey="Ingresos" stroke="var(--color-accent)" strokeWidth={2}
                    fill="url(#gradIngresos)"
                  />
                  <Area
                    type="monotone" dataKey="Egresos" stroke="var(--color-text-dim)" strokeWidth={2}
                    strokeDasharray="5 4" fill="none"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <VacioChart mensaje="No hubo movimientos en este período." />
          )}
          <div className="flex gap-4 text-xs text-text-dim">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-accent" /> Ingresos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-text-dim" /> Egresos
            </span>
          </div>
        </Card>

        <Card titulo="Cómo te pagan" subtitulo="Reparto del cobro por medio">
          {metodos.length > 0 ? (
            <>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metodos} dataKey="value" nameKey="name"
                      innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none"
                    >
                      {metodos.map((m, i) => (
                        <Cell key={m.name} fill={COLORES_METODO[i % COLORES_METODO.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatMoney(Number(v) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {metodos.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORES_METODO[i % COLORES_METODO.length] }}
                    />
                    <span className="flex-1 truncate text-text-dim">{m.name}</span>
                    <span className="tabular-nums text-text">{formatMoney(m.value)}</span>
                    <span className="w-12 text-right text-xs tabular-nums text-text-dim">
                      {m.pct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <VacioChart mensaje="Todavía no hay cobros registrados." />
          )}
        </Card>
      </div>

      <Card
        titulo="Cantidad de ventas y ticket promedio"
        subtitulo="Cuántas veces vendiste cada día, y si esas ventas fueron grandes o chicas"
      >
        {huboVentas ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="dia" {...EJE_PROPS} minTickGap={24} />
                <YAxis yAxisId="cantidad" {...EJE_PROPS} width={36} allowDecimals={false} />
                <YAxis yAxisId="ticket" orientation="right" {...EJE_PROPS} width={58} tickFormatter={montoCorto} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(v, nombre) => (nombre === 'Ticket promedio' ? formatMoney(Number(v) || 0) : v)}
                />
                <Bar yAxisId="cantidad" dataKey="Ventas" fill="var(--color-accent)" radius={[4, 4, 0, 0]} barSize={18} />
                <Line
                  yAxisId="ticket" type="monotone" dataKey="Ticket promedio"
                  stroke="var(--color-accent-2)" strokeWidth={2} dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <VacioChart mensaje="No hubo ventas en este período." />
        )}
        <div className="flex gap-4 text-xs text-text-dim">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-accent" /> Cantidad de ventas (eje izquierdo)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-accent-2" /> Ticket promedio (eje derecho, en $)
          </span>
        </div>
        <p className="text-xs text-text-dim">
          Vender más veces no siempre significa vender más plata: si las barras suben pero la línea
          baja, ese día entraron más clientes pero compraron menos por visita — al revés, menos gente
          pero tickets grandes. Cruzalo con "Horas de mayor venta" para saber si conviene reforzar el
          mostrador o armar combos que empujen el ticket.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card titulo="Mejores clientes" subtitulo="Los que más facturaron en el período">
          {data.top_clientes.length > 0 ? (
            <BarraRanking
              filas={data.top_clientes.map((c) => ({
                nombre: c.nombre,
                valor: Number(c.ingresos),
                etiqueta: formatMoney(c.ingresos),
                detalle: `${c.cantidad_ventas} compra${c.cantidad_ventas === 1 ? '' : 's'}`,
              }))}
            />
          ) : (
            <VacioChart mensaje="Ninguna venta quedó asociada a un cliente." />
          )}
        </Card>

        <Card titulo="Horas de mayor venta" subtitulo="Para saber cuándo reforzar el mostrador">
          {horas.length > 0 ? (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="hora" {...EJE_PROPS} minTickGap={8} />
                  <YAxis {...EJE_PROPS} width={52} tickFormatter={montoCorto} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatMoney(Number(v) || 0)} />
                  <Bar dataKey="ingresos" fill="var(--color-accent-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <VacioChart mensaje="Sin ventas en el período." />
          )}
        </Card>

        <MetricCard
          label="Capital inmovilizado"
          value={formatMoney(kpis.capital_inmovilizado)}
          icon={Package}
          hint={`${kpis.productos_sin_rotacion} productos con stock que no se vendieron ni una vez en el período`}
        />
      </div>

      <Card titulo="Actividad reciente" subtitulo="Los últimos movimientos de plata">
        {data.actividad.length > 0 ? (
          <div className="flex flex-col">
            {data.actividad.map((e, i) => <FilaActividad key={`${e.tipo}-${i}`} evento={e} />)}
          </div>
        ) : (
          <VacioChart mensaje="Sin movimientos todavía." />
        )}
      </Card>
    </div>
  )
}
