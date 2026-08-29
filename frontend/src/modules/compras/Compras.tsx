import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { CompraDetalleModal } from './CompraDetalleModal'
import { CompraFiltrosBar } from './CompraFiltrosBar'
import { CompraFormModal } from './CompraFormModal'
import { PagoCompraModal } from './PagoCompraModal'
import { StatCard, StatRow } from '../../components/ui/StatCard'
import { useCompras } from './api'
import type { Compra, CompraFiltros, EstadoCompra } from './types'

const ESTILO_ESTADO: Record<EstadoCompra, string> = {
  pendiente: 'border-warning/40 bg-warning/10 text-warning',
  parcial: 'border-accent/40 bg-accent/10 text-accent',
  pagada: 'border-accent-2/40 bg-accent-2/10 text-accent-2',
}

const LABEL_ESTADO: Record<EstadoCompra, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagada: 'Pagada',
}

function EstadoBadge({ compra }: { compra: Compra }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ESTILO_ESTADO[compra.estado]}`}>
      {LABEL_ESTADO[compra.estado]}
    </span>
  )
}

/** Fecha de vencimiento, resaltada si ya pasó y la factura sigue impaga. */
function Vencimiento({ compra }: { compra: Compra }) {
  if (!compra.fecha_vencimiento) return <span className="text-text-dim">—</span>
  const vencida = compra.estado !== 'pagada' && compra.fecha_vencimiento < hoyISO()
  return (
    <span className={vencida ? 'flex items-center gap-1 font-medium text-danger' : 'text-text-dim'}>
      {vencida && <AlertTriangle size={13} />}
      {formatFechaSola(compra.fecha_vencimiento)}
    </span>
  )
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export function Compras() {
  const [filtros, setFiltros] = useState<CompraFiltros>({})
  const { data: compras, isLoading, error, refetch } = useCompras(filtros)
  const [showForm, setShowForm] = useState(false)
  const [seleccionada, setSeleccionada] = useState<Compra | null>(null)
  const [aPagar, setAPagar] = useState<Compra | null>(null)

  const stats = useMemo(() => {
    const lista = compras ?? []
    const total = lista.reduce((acc, c) => acc + Number(c.total), 0)
    // Lo que falta pagar, no el total de las facturas impagas: una compra
    // pagada a medias solo debe su saldo.
    const pendiente = lista.reduce((acc, c) => acc + Number(c.saldo_pendiente), 0)
    const proveedores = new Set(lista.map((c) => c.proveedor).filter(Boolean)).size
    return { total, pendiente, cantidad: lista.length, proveedores }
  }, [compras])

  const columns: Column<Compra>[] = [
    { header: 'Fecha', render: (c) => formatFechaSola(c.fecha) },
    { header: 'Proveedor', render: (c) => c.proveedor_nombre ?? 'Sin proveedor' },
    { header: 'N° Factura', render: (c) => c.numero_factura || '—' },
    { header: 'Vence', render: (c) => <Vencimiento compra={c} /> },
    { header: 'Total', render: (c) => formatMoney(c.total), className: 'tabular-nums' },
    {
      header: 'Falta pagar',
      render: (c) => (Number(c.saldo_pendiente) > 0 ? formatMoney(c.saldo_pendiente) : '—'),
      className: 'tabular-nums text-warning',
    },
    { header: 'Estado', render: (c) => <EstadoBadge compra={c} /> },
    {
      header: '',
      className: 'text-right',
      render: (c) =>
        c.estado === 'pagada' ? null : (
          <Button
            onClick={(e) => { e.stopPropagation(); setAPagar(c) }}
            className="!px-2.5 !py-1 text-xs"
          >
            <Wallet size={13} /> Pagar
          </Button>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <StatRow>
        <StatCard label="Total comprado" value={formatMoney(stats.total)} variant="total" />
        <StatCard label="Pendiente de pago" value={formatMoney(stats.pendiente)} variant="danger" />
        <StatCard label="Compras" value={stats.cantidad} variant="accent" />
        <StatCard label="Proveedores distintos" value={stats.proveedores} variant="teal" />
      </StatRow>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <CompraFiltrosBar value={filtros} onChange={setFiltros} />
        <Button onClick={() => setShowForm(true)} className="shrink-0"><Plus size={15} /> Nueva compra</Button>
      </div>
      <p className="text-xs text-text-dim">
        Cada compra suma stock y actualiza la cuenta corriente del proveedor. Las fiadas se pagan después
        con "Pagar" — el gasto cuenta el día del pago, no el día que llegó la mercadería. Hacé clic en una
        fila para ver el detalle.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando compras…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={compras ?? []}
          rowKey={(c) => c.id}
          emptyMessage="No hay compras para estos filtros."
          onRowClick={setSeleccionada}
          error={error}
          onRetry={refetch}
        />
      )}

      {showForm && <CompraFormModal onClose={() => setShowForm(false)} />}
      {seleccionada && <CompraDetalleModal compra={seleccionada} onClose={() => setSeleccionada(null)} />}
      {aPagar && <PagoCompraModal compra={aPagar} onClose={() => setAPagar(null)} />}
    </div>
  )
}
