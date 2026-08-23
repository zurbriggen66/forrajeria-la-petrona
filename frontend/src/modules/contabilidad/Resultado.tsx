import { useState } from 'react'
import { ArrowRight, Download, Loader2, Target } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { descargarCSV } from '../../lib/csv'
import { formatFechaSola, formatMoney, formatPct } from '../../lib/format'
import { EJE_PROPS, TOOLTIP_PROPS, montoCorto } from '../estadisticas/chart'
import { Card } from '../estadisticas/PanelWidgets'
import { FiltrosBar } from '../ventas/FiltrosBar'
import type { VentasFiltros } from '../ventas/types'
import { useResultadoContable } from './api'
import type { CategoriaRentabilidad } from './types'

/** Una línea del estado de resultados. `signo` marca si resta (se muestra en
 * rojo con paréntesis, como en un balance) y `fuerte` si es un subtotal. */
function Linea({ concepto, monto, detalle, resta = false, fuerte = false, borde = false }: {
  concepto: string
  monto: string
  detalle?: string
  resta?: boolean
  fuerte?: boolean
  borde?: boolean
}) {
  const valor = Number(monto)
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${borde ? 'border-t border-border' : ''}`}>
      <div className="min-w-0">
        <span className={fuerte ? 'font-medium text-text' : 'text-text-dim'}>{concepto}</span>
        {detalle && <span className="ml-2 text-xs text-text-dim">{detalle}</span>}
      </div>
      <span
        className={`shrink-0 tabular-nums ${
          fuerte ? 'font-display text-lg font-semibold' : 'text-sm'
        } ${resta ? 'text-danger' : valor < 0 ? 'text-danger' : fuerte ? 'text-text' : 'text-text'}`}
      >
        {resta ? `(${formatMoney(Math.abs(valor))})` : formatMoney(valor)}
      </span>
    </div>
  )
}

export function Resultado() {
  const [filtros, setFiltros] = useState<VentasFiltros>({})
  const { data, isLoading } = useResultadoContable(filtros)

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

  const { resultado: r, flujo: f, conciliacion: c, equilibrio: eq, periodo } = data
  const categorias = data.por_categoria

  function exportar() {
    descargarCSV(`resultado_${periodo.desde}_a_${periodo.hasta}`,
      ['Concepto', 'Monto'],
      [
        ['Ventas', Number(r.ingresos)],
        ['Costo de la mercadería vendida', -Number(r.cmv)],
        ['Margen bruto', Number(r.margen_bruto)],
        ['Gastos fijos', -Number(r.gastos_fijos)],
        ['Gastos variables', -Number(r.gastos_variables)],
        ['RESULTADO', Number(r.resultado)],
        ['', ''],
        ['Cobrado de ventas', Number(f.cobrado_ventas)],
        ['Cobros de cuenta corriente', Number(f.cobros_cuenta_corriente)],
        ['Gastos pagados', -Number(f.gastos)],
        ['Pagos a proveedores', -Number(f.pagos_proveedor)],
        ['FLUJO DE CAJA', Number(f.flujo_neto)],
      ])
  }

  // El puente entre las dos miradas, como cascada.
  const puente = [
    { nombre: 'Resultado', valor: Number(c.resultado), tipo: 'base' },
    { nombre: 'Fiado', valor: -Number(c.ventas_fiadas), tipo: 'ajuste' },
    { nombre: 'Cobros c.c.', valor: Number(c.cobros_cuenta_corriente), tipo: 'ajuste' },
    { nombre: 'Costo mercadería', valor: Number(c.cmv), tipo: 'ajuste' },
    { nombre: 'Pagos proveedor', valor: -Number(c.pagos_proveedor), tipo: 'ajuste' },
    { nombre: 'Caja', valor: Number(c.flujo_neto), tipo: 'base' },
  ]

  const columnas: Column<CategoriaRentabilidad>[] = [
    { header: 'Rubro', render: (x) => x.categoria },
    { header: 'Ventas', render: (x) => formatMoney(x.ingresos), className: 'tabular-nums' },
    { header: 'Costo', render: (x) => formatMoney(x.costo), className: 'tabular-nums text-text-dim' },
    { header: 'Margen', render: (x) => formatMoney(x.margen), className: 'tabular-nums text-accent-2' },
    {
      header: '% Margen',
      render: (x) => (
        <span className={x.margen_pct >= 30 ? 'text-accent-2' : x.margen_pct >= 0 ? 'text-warning' : 'text-danger'}>
          {formatPct(x.margen_pct)}
        </span>
      ),
      className: 'tabular-nums',
    },
    {
      header: '% de las ventas',
      render: (x) => `${x.participacion_pct.toFixed(1)}%`,
      className: 'tabular-nums text-text-dim',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <FiltrosBar value={filtros} onChange={setFiltros} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-dim">
          Período: {formatFechaSola(periodo.desde)} — {formatFechaSola(periodo.hasta)}
        </p>
        <Button variant="secondary" onClick={exportar}><Download size={15} /> Exportar CSV</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="Resultado" subtitulo="¿El negocio gana plata?">
          <div className="flex flex-col">
            <Linea concepto="Ventas" monto={r.ingresos} fuerte />
            <Linea concepto="Costo de la mercadería vendida" monto={r.cmv} resta />
            <Linea concepto="Margen bruto" monto={r.margen_bruto} detalle={formatPct(r.margen_bruto_pct)} fuerte borde />
            <Linea concepto="Gastos fijos" monto={r.gastos_fijos} resta />
            <Linea concepto="Gastos variables" monto={r.gastos_variables} resta />
            <Linea concepto="Resultado del período" monto={r.resultado} fuerte borde />
          </div>
          <p className="text-xs text-text-dim">
            Comprar mercadería no figura acá: no es un gasto, es cambiar plata por stock. Pesa
            cuando se vende, a través del costo de la mercadería vendida.
          </p>
        </Card>

        <Card titulo="Flujo de caja" subtitulo="¿Cuánta plata entró y salió de verdad?">
          <div className="flex flex-col">
            <Linea concepto="Cobrado de ventas" monto={f.cobrado_ventas} />
            <Linea concepto="Cobros de cuenta corriente" monto={f.cobros_cuenta_corriente} />
            <Linea concepto="Total entradas" monto={f.entradas} fuerte borde />
            <Linea concepto="Gastos pagados" monto={f.gastos} resta />
            <Linea concepto="Pagos a proveedores" monto={f.pagos_proveedor} resta />
            <Linea concepto="Movimiento neto de caja" monto={f.flujo_neto} fuerte borde />
          </div>
          <p className="text-xs text-text-dim">
            Lo que se vendió fiado no entra hasta que el cliente pague.
          </p>
        </Card>
      </div>

      <Card
        titulo="Del resultado a la caja"
        subtitulo="Por qué ganar plata y tener plata no son lo mismo"
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={puente} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="nombre" {...EJE_PROPS} interval={0} />
              <YAxis {...EJE_PROPS} width={62} tickFormatter={montoCorto} />
              <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatMoney(Number(v) || 0)} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {puente.map((p) => (
                  <Cell
                    key={p.nombre}
                    fill={
                      p.tipo === 'base'
                        ? 'var(--color-accent)'
                        : p.valor >= 0 ? 'var(--color-accent-2)' : 'var(--color-danger)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-text-dim">
          Resultado {formatMoney(c.resultado)} <ArrowRight size={12} /> se le resta lo fiado, se le
          suman los cobros de cuenta corriente y el costo de mercadería (que no fue salida de caja),
          se le restan los pagos a proveedores <ArrowRight size={12} /> caja {formatMoney(c.flujo_neto)}.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card titulo="Punto de equilibrio" subtitulo="Cuánto hay que vender para no perder">
          {eq.alcanzable ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-dim">Venta necesaria</p>
                <p className="font-display text-2xl font-bold tabular-nums text-text">
                  {formatMoney(eq.venta_necesaria)}
                </p>
                <p className="mt-1 text-xs text-text-dim">
                  Con un margen de {eq.margen_ratio_pct.toFixed(1)}% sobre lo vendido.
                </p>
              </div>
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                Number(eq.diferencia) >= 0
                  ? 'border-accent-2/40 bg-accent-2/10 text-accent-2'
                  : 'border-danger/40 bg-danger/10 text-danger'
              }`}>
                <Target size={15} />
                {Number(eq.diferencia) >= 0
                  ? `Superado por ${formatMoney(eq.diferencia)}`
                  : `Faltaron ${formatMoney(Math.abs(Number(eq.diferencia)))}`}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-dim">
              Sin ventas con margen positivo en el período no se puede calcular.
            </p>
          )}
        </Card>

        <Card titulo="Rentabilidad por rubro" subtitulo="Qué deja plata de verdad">
          <Table
            columns={columnas} rows={categorias} rowKey={(x) => x.categoria}
            emptyMessage="Sin ventas en el período."
          />
        </Card>
      </div>
    </div>
  )
}
