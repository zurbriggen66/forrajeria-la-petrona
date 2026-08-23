import { Download, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { descargarCSV } from '../../lib/csv'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { Card } from '../estadisticas/PanelWidgets'
import { useDeudas } from './api'
import type { DeudorDetalle, Tramos } from './types'

const TRAMOS: { key: keyof Tramos; label: string; color: string }[] = [
  { key: 'al_dia', label: 'Hasta 30 días', color: 'bg-accent-2' },
  { key: 'd31_60', label: '31 a 60 días', color: 'bg-warning' },
  { key: 'd61_90', label: '61 a 90 días', color: 'bg-accent' },
  { key: 'mas_90', label: 'Más de 90 días', color: 'bg-danger' },
]

/** Barra apilada con la composición de la deuda por antigüedad: a un vistazo
 * se ve cuánto de lo que te deben es plata vieja. */
function BarraTramos({ tramos, total }: { tramos: Tramos; total: number }) {
  if (total <= 0) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        {TRAMOS.map((t) => {
          const pct = (Number(tramos[t.key]) / total) * 100
          if (pct <= 0) return null
          return <div key={t.key} className={t.color} style={{ width: `${pct}%` }} title={t.label} />
        })}
      </div>
      <div className="flex flex-col gap-1">
        {TRAMOS.map((t) => {
          const monto = Number(tramos[t.key])
          if (monto <= 0) return null
          return (
            <div key={t.key} className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${t.color}`} />
              <span className="flex-1 text-text-dim">{t.label}</span>
              <span className="tabular-nums text-text">{formatMoney(monto)}</span>
              <span className="w-12 text-right text-xs tabular-nums text-text-dim">
                {((monto / total) * 100).toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function colorDias(dias: number) {
  if (dias > 90) return 'text-danger'
  if (dias > 60) return 'text-accent'
  if (dias > 30) return 'text-warning'
  return 'text-text-dim'
}

/** Los días son negativos cuando la factura todavía no venció: mostrar
 * "-30 días" confunde, se lee mejor "vence en 30 días". */
function Antiguedad({ dias }: { dias: number }) {
  if (dias < 0) {
    return <span className="text-accent-2">vence en {Math.abs(dias)} días</span>
  }
  return <span className={colorDias(dias)}>{dias} días</span>
}

export function DeudasAging() {
  const { data, isLoading } = useDeudas()

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Calculando…
      </div>
    )
  }

  // Se copia a un const ya angostado: TS no propaga el narrowing del early
  // return dentro de los closures (exportar()).
  const deudas = data
  const cobrar = Number(data.por_cobrar.total)
  const pagar = Number(data.por_pagar.total)

  const colsClientes: Column<DeudorDetalle>[] = [
    { header: 'Cliente', render: (d) => d.nombre },
    { header: 'Debe', render: (d) => formatMoney(d.saldo), className: 'tabular-nums text-danger' },
    {
      header: 'Antigüedad',
      render: (d) => <Antiguedad dias={d.dias} />,
      className: 'tabular-nums',
    },
  ]

  const colsProveedores: Column<DeudorDetalle>[] = [
    { header: 'Proveedor', render: (d) => d.nombre },
    { header: 'Factura', render: (d) => d.numero_factura || '—', className: 'text-text-dim' },
    {
      header: 'Vence',
      render: (d) => (d.vencimiento ? formatFechaSola(d.vencimiento) : '—'),
      className: 'text-text-dim',
    },
    { header: 'Saldo', render: (d) => formatMoney(d.saldo), className: 'tabular-nums text-warning' },
    {
      header: 'Antigüedad',
      render: (d) => <Antiguedad dias={d.dias} />,
      className: 'tabular-nums',
    },
  ]

  function exportar() {
    descargarCSV(`deudas_${deudas.fecha}`,
      ['Tipo', 'Nombre', 'Referencia', 'Saldo', 'Días'],
      [
        ...deudas.por_cobrar.detalle.map((d) => ['Me deben', d.nombre, '', Number(d.saldo), d.dias]),
        ...deudas.por_pagar.detalle.map((d) => ['Debo', d.nombre, d.numero_factura ?? '', Number(d.saldo), d.dias]),
      ])
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-dim">
          Al {formatFechaSola(data.fecha)}. En clientes, los pagos se aplican primero a lo más viejo,
          así que lo que figura vencido es deuda que realmente sigue sin saldarse.
        </p>
        <Button variant="secondary" onClick={exportar}><Download size={15} /> Exportar CSV</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Me deben"
          subtitulo="Cuentas corrientes de clientes"
          accion={<span className="font-display text-lg font-semibold tabular-nums text-danger">{formatMoney(cobrar)}</span>}
        >
          {cobrar > 0
            ? <BarraTramos tramos={data.por_cobrar.tramos} total={cobrar} />
            : <p className="py-4 text-center text-sm text-text-dim">Nadie te debe plata.</p>}
        </Card>

        <Card
          titulo="Debo"
          subtitulo="Facturas de proveedor sin saldar"
          accion={<span className="font-display text-lg font-semibold tabular-nums text-warning">{formatMoney(pagar)}</span>}
        >
          {pagar > 0
            ? <BarraTramos tramos={data.por_pagar.tramos} total={pagar} />
            : <p className="py-4 text-center text-sm text-text-dim">No debés nada a proveedores.</p>}
        </Card>
      </div>

      <Card titulo="Clientes con deuda" subtitulo="Ordenados por monto — por dónde empezar a cobrar">
        <Table
          columns={colsClientes} rows={data.por_cobrar.detalle} rowKey={(d) => d.id}
          emptyMessage="Ningún cliente con saldo pendiente."
        />
      </Card>

      <Card titulo="Facturas por pagar" subtitulo="Compras fiadas sin saldar">
        <Table
          columns={colsProveedores} rows={data.por_pagar.detalle} rowKey={(d) => d.id}
          emptyMessage="Ninguna factura pendiente."
        />
      </Card>
    </div>
  )
}
