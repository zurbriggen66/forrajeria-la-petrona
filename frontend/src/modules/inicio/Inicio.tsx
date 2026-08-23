import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Bike, FileText, Loader2, Minus, PackagePlus, PackageSearch,
  ShoppingBag, ShoppingCart, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { StatCard, StatRow } from '../../components/ui/StatCard'
import { Table, type Column } from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import { formatMoney } from '../../lib/format'
import { useCajaActual } from '../caja/api'
import { useInicio } from './api'
import type { Deudor, InicioDiaSerie, TopProductoHoy } from './types'

function saludo() {
  const hora = new Date().getHours()
  if (hora < 13) return 'Buen día'
  if (hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

/** "lun 18" — etiqueta corta para el eje del gráfico. `fecha` viene como
 * 'YYYY-MM-DD'; se parsea a mano para no correrse un día por UTC-3. */
function diaCorto(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
    .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
    .replace('.', '')
}

function Variacion({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs font-normal opacity-70">sin dato de ayer</span>
  }
  const Icono = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  return (
    <span className="flex items-center gap-1 text-xs font-normal opacity-80">
      <Icono size={12} />
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}% vs ayer
    </span>
  )
}

function Panel({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-text">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

/** Fila de "algo que hay que hacer". Si el contador está en cero se muestra
 * apagada en vez de ocultarse: que el dueño vea "0 repartos" es información,
 * un bloque que aparece y desaparece es desconcertante. */
function Pendiente({ icono: Icono, label, valor, to, alerta }: {
  icono: typeof Bike
  label: string
  valor: number
  to: string
  alerta?: boolean
}) {
  const activo = valor > 0
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
        activo
          ? 'border-border bg-surface-2 text-text hover:border-accent/50'
          : 'border-transparent text-text-dim hover:bg-surface-2'
      }`}
    >
      <span className="flex items-center gap-2">
        <Icono size={14} className={activo && alerta ? 'text-warning' : 'text-text-dim'} />
        {label}
      </span>
      <span className={`font-display text-base font-semibold tabular-nums ${
        activo && alerta ? 'text-warning' : activo ? 'text-accent' : 'text-text-dim'
      }`}>
        {valor}
      </span>
    </Link>
  )
}

const ACCESOS = [
  { label: 'Nueva venta', to: '/pos', icono: ShoppingCart },
  { label: 'Nuevo reparto', to: '/repartos', icono: Bike },
  { label: 'Cargar producto', to: '/productos/listado', icono: PackagePlus },
  { label: 'Compras y gastos', to: '/compras', icono: ShoppingBag },
]

export function Inicio() {
  const { user, comercio } = useAuth()
  const { data, isLoading } = useInicio()
  const { data: caja } = useCajaActual()

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Cargando el resumen del día…
      </div>
    )
  }

  const { hoy, comparacion, pendientes, deudas } = data
  const veFinanzas = deudas !== null

  const serie = data.serie_7dias.map((d: InicioDiaSerie) => ({
    dia: diaCorto(d.fecha),
    ingresos: Number(d.ingresos),
  }))
  const huboVentasEnLaSemana = serie.some((d) => d.ingresos > 0)

  const columnasTop: Column<TopProductoHoy>[] = [
    { header: 'Producto', render: (p) => p.nombre },
    { header: 'Cant.', render: (p) => Number(p.cantidad), className: 'tabular-nums text-text-dim' },
    { header: 'Total', render: (p) => formatMoney(p.ingresos), className: 'tabular-nums' },
  ]
  const columnasDeudores: Column<Deudor>[] = [
    { header: 'Cliente', render: (d) => d.nombre },
    { header: 'Debe', render: (d) => formatMoney(d.saldo_actual), className: 'tabular-nums text-danger' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-text">
            {saludo()}, {user?.nombre_completo?.split(' ')[0] ?? ''}
          </h1>
          {/* first-letter, no `capitalize`: eso pondría "22 De Agosto". */}
          <p className="text-sm text-text-dim first-letter:uppercase">
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
            {comercio && <span className="normal-case"> · {comercio.nombre}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCESOS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:border-accent/50 hover:text-accent"
            >
              <a.icono size={15} /> {a.label}
            </Link>
          ))}
          <Link
            to="/caja/contenedores"
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              caja
                ? 'border border-accent-2/40 bg-accent-2/10 text-accent-2 hover:bg-accent-2/20'
                : 'bg-gradient-brand text-accent-ink hover:brightness-110'
            }`}
          >
            <Wallet size={15} /> {caja ? 'Ver caja' : 'Abrir caja'}
          </Link>
        </div>
      </header>

      <StatRow>
        <StatCard
          label="Ventas de hoy" variant="accent"
          value={
            <span className="flex flex-col">
              {formatMoney(hoy.ingresos)}
              <Variacion pct={comparacion.variacion_ingresos_pct} />
            </span>
          }
        />
        <StatCard
          label="Tickets" variant="teal"
          value={
            <span className="flex flex-col">
              {hoy.cantidad_ventas}
              <Variacion pct={comparacion.variacion_cantidad_pct} />
            </span>
          }
        />
        <StatCard label="Ticket promedio" value={formatMoney(hoy.ticket_promedio)} variant="gold" />
        {veFinanzas && (
          <StatCard label="Gastos de hoy" value={formatMoney(hoy.egresos ?? 0)} variant="danger" />
        )}
        {veFinanzas && (
          <StatCard label="Balance del día" value={formatMoney(hoy.balance ?? 0)} variant="total" />
        )}
      </StatRow>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel
          titulo="Ventas de los últimos 7 días"
          accion={
            <span className="text-xs text-text-dim">
              Promedio diario {formatMoney(comparacion.promedio_diario_7d)}
            </span>
          }
        >
          {huboVentasEnLaSemana ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="dia" tickLine={false} axisLine={false}
                    tick={{ fill: 'var(--color-text-dim)', fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false} axisLine={false} width={70}
                    tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }}
                    tickFormatter={(v: number) => formatMoney(v).replace(',00', '')}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-surface-2)' }}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      color: 'var(--color-text)',
                    }}
                    labelStyle={{ color: 'var(--color-text-dim)' }}
                    // recharts tipa el valor como ValueType (puede venir
                    // undefined o array), así que se normaliza antes de formatear.
                    formatter={(v) => [formatMoney(Number(v) || 0), 'Ventas'] as [string, string]}
                  />
                  <Bar dataKey="ingresos" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-text-dim">
              Todavía no hay ventas registradas esta semana.
            </p>
          )}
        </Panel>

        <Panel
          titulo="Caja"
          accion={
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              caja ? 'border-accent-2/40 text-accent-2' : 'border-border text-text-dim'
            }`}>
              {caja ? 'Abierta' : 'Cerrada'}
            </span>
          }
        >
          {caja ? (
            <div className="flex flex-col gap-1.5">
              {caja.contenedores.map((c) => (
                <div key={c.cuenta} className="flex items-center justify-between text-sm">
                  <span className="text-text-dim">{c.nombre}</span>
                  <span className="tabular-nums text-text">{formatMoney(c.saldo_turno)}</span>
                </div>
              ))}
              {caja.contenedores.length === 0 && (
                <p className="text-sm text-text-dim">Sin movimientos en este turno.</p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-dim">
              La caja está cerrada. Abrila para empezar a vender.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel titulo="Pendientes de hoy">
          <div className="flex flex-col gap-1">
            <Pendiente icono={Bike} label="Repartos para hoy" valor={pendientes.repartos_hoy} to="/repartos" />
            <Pendiente icono={FileText} label="Presupuestos sin responder" valor={pendientes.presupuestos_pendientes} to="/presupuestos" />
            <Pendiente
              icono={Wallet}
              label={pendientes.facturas_vencidas > 0
                ? `Facturas por pagar (${pendientes.facturas_vencidas} vencida${pendientes.facturas_vencidas === 1 ? '' : 's'})`
                : 'Facturas por pagar'}
              valor={pendientes.facturas_por_pagar}
              to="/compras"
              alerta={pendientes.facturas_vencidas > 0}
            />
            <Pendiente icono={AlertTriangle} label="Productos con stock bajo" valor={pendientes.stock_bajo} to="/stock" alerta />
            <Pendiente icono={AlertTriangle} label="Productos sin stock" valor={pendientes.sin_stock} to="/stock" alerta />
            <Pendiente icono={PackageSearch} label="Para pedir a proveedores" valor={pendientes.pedidos_sugeridos} to="/compras" />
          </div>
        </Panel>

        {veFinanzas && deudas && (
          <Panel
            titulo="Plata en la calle"
            accion={
              <Link to="/clientes" className="text-xs text-text-dim hover:text-accent">Ver clientes</Link>
            }
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-wide text-text-dim">Me deben</p>
                <p className="font-display text-xl font-semibold tabular-nums text-danger">
                  {formatMoney(deudas.total_por_cobrar)}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-wide text-text-dim">Debo a proveedores</p>
                <p className="font-display text-xl font-semibold tabular-nums text-warning">
                  {formatMoney(deudas.total_por_pagar)}
                </p>
              </div>
            </div>
            <Table
              columns={columnasDeudores} rows={deudas.top_deudores} rowKey={(d) => d.id}
              emptyMessage="Nadie te debe plata."
            />
          </Panel>
        )}

        <Panel titulo="Lo más vendido hoy">
          <Table
            columns={columnasTop} rows={data.top_productos_hoy}
            rowKey={(p) => p.producto ?? p.nombre}
            emptyMessage="Todavía no hubo ventas hoy."
          />
        </Panel>
      </div>
    </div>
  )
}
