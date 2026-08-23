import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Table, type Column } from '../../components/ui/Table'
import { descargarCSV } from '../../lib/csv'
import { formatMoney } from '../../lib/format'
import { EJE_PROPS, TOOLTIP_PROPS, montoCorto } from '../estadisticas/chart'
import { Card } from '../estadisticas/PanelWidgets'
import { useMensual } from './api'
import type { MesContable } from './types'

/** 'YYYY-MM-01' → 'ago 26'. Se parsea a mano para no correr el mes por UTC. */
function mesCorto(fecha: string) {
  const [anio, mes] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, 1)
    .toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
    .replace('.', '')
}

export function MesAMes() {
  const [meses, setMeses] = useState(12)
  const { data, isLoading } = useMensual(meses)

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Calculando…
      </div>
    )
  }

  const meses_ = data
  const serie = data.map((m) => ({
    mes: mesCorto(m.mes),
    Ventas: Number(m.ingresos),
    Gastos: Number(m.gastos) + Number(m.cmv),
    Resultado: Number(m.resultado),
  }))

  const totales = data.reduce(
    (acc, m) => ({
      ingresos: acc.ingresos + Number(m.ingresos),
      cmv: acc.cmv + Number(m.cmv),
      gastos: acc.gastos + Number(m.gastos),
      resultado: acc.resultado + Number(m.resultado),
    }),
    { ingresos: 0, cmv: 0, gastos: 0, resultado: 0 },
  )

  function exportar() {
    descargarCSV(`mes_a_mes_${meses}m`,
      ['Mes', 'Ventas', 'Costo mercadería', 'Margen bruto', 'Gastos', 'Resultado'],
      meses_.map((m) => [
        m.mes.slice(0, 7), Number(m.ingresos), Number(m.cmv),
        Number(m.margen_bruto), Number(m.gastos), Number(m.resultado),
      ]))
  }

  const columnas: Column<MesContable>[] = [
    { header: 'Mes', render: (m) => <span className="font-medium">{mesCorto(m.mes)}</span> },
    { header: 'Ventas', render: (m) => formatMoney(m.ingresos), className: 'tabular-nums' },
    { header: 'Costo mercadería', render: (m) => formatMoney(m.cmv), className: 'tabular-nums text-text-dim' },
    { header: 'Margen bruto', render: (m) => formatMoney(m.margen_bruto), className: 'tabular-nums' },
    { header: 'Gastos', render: (m) => formatMoney(m.gastos), className: 'tabular-nums text-text-dim' },
    {
      header: 'Resultado',
      render: (m) => (
        <span className={Number(m.resultado) >= 0 ? 'text-accent-2' : 'text-danger'}>
          {formatMoney(m.resultado)}
        </span>
      ),
      className: 'tabular-nums font-medium',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Select
          id="meses" label="Período" value={String(meses)}
          onChange={(e) => setMeses(Number(e.target.value))} className="w-44"
        >
          <option value="6">Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
          <option value="24">Últimos 24 meses</option>
        </Select>
        <Button variant="secondary" onClick={exportar}><Download size={15} /> Exportar CSV</Button>
      </div>

      <Card titulo="Evolución" subtitulo="Ventas contra costos totales, y el resultado de cada mes">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="mes" {...EJE_PROPS} />
              <YAxis {...EJE_PROPS} width={62} tickFormatter={montoCorto} />
              <Tooltip {...TOOLTIP_PROPS} formatter={(v) => formatMoney(Number(v) || 0)} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-dim)' }} />
              <Bar dataKey="Ventas" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="var(--color-surface-2)" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone" dataKey="Resultado" stroke="var(--color-accent-2)"
                strokeWidth={2} dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        titulo="Detalle mensual"
        accion={
          <span className="text-xs text-text-dim">
            Acumulado: ventas {formatMoney(totales.ingresos)} · resultado{' '}
            <span className={totales.resultado >= 0 ? 'text-accent-2' : 'text-danger'}>
              {formatMoney(totales.resultado)}
            </span>
          </span>
        }
      >
        <Table columns={columnas} rows={data} rowKey={(m) => m.mes} emptyMessage="Sin datos." />
      </Card>
    </div>
  )
}
