import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Paginacion } from '../../components/ui/Paginacion'
import { Table, type Column } from '../../components/ui/Table'
import { Select } from '../../components/ui/Select'
import { formatMoney } from '../../lib/format'
import { FiltrosBar } from './FiltrosBar'
import { TicketDetalleModal } from './TicketDetalleModal'
import { VENTAS_POR_PAGINA, useVentas } from './api'
import type { Venta, VentasFiltros } from './types'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Origen de la venta (Venta.origen). El mostrador no se etiqueta: es el caso
 * normal y ponerle un cartel a todas las filas sería ruido. */
const ORIGENES: Record<string, { label: string; estilo: string }> = {
  presupuesto: { label: 'Presupuesto', estilo: 'border-accent/40 text-accent' },
  reparto: { label: 'Reparto', estilo: 'border-accent-2/40 text-accent-2' },
}

export function HistorialVentas() {
  const [filtros, setFiltros] = useState<VentasFiltros>({})
  const [estado, setEstado] = useState<'todas' | 'activas' | 'anuladas'>('activas')
  const [pagina, setPagina] = useState(1)
  const [seleccionada, setSeleccionada] = useState<Venta | null>(null)

  const filtrosConEstado: VentasFiltros = {
    ...filtros,
    ...(estado === 'activas' ? { anulada: false } : estado === 'anuladas' ? { anulada: true } : {}),
    page: pagina,
  }
  const { data, isLoading, error, refetch } = useVentas(filtrosConEstado)

  /** Al cambiar un filtro hay que volver a la página 1: la página actual
   * puede no existir en el resultado filtrado. */
  function filtrar(cambio: () => void) {
    cambio()
    setPagina(1)
  }

  const columns: Column<Venta>[] = [
    {
      header: 'Ticket',
      render: (v) => (
        <span className="flex items-center gap-1.5">
          #{v.numero_ticket ?? '—'}
          {/* De dónde salió la venta. Todas descuentan stock y entran a caja
              igual, pero una que vino de un presupuesto aprobado se veía
              idéntica a una del mostrador y no había forma de distinguirlas. */}
          {ORIGENES[v.origen] && (
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ORIGENES[v.origen].estilo}`}>
              {ORIGENES[v.origen].label}
            </span>
          )}
        </span>
      ),
    },
    { header: 'Fecha', render: (v) => formatFecha(v.created_at) },
    { header: 'Vendedor', render: (v) => v.vendedor_nombre ?? '—' },
    { header: 'Cliente', render: (v) => v.cliente_nombre ?? 'Consumidor final' },
    { header: 'Método', render: (v) => v.cuenta_pago_nombre ?? 'Efectivo' },
    { header: 'Total', render: (v) => formatMoney(v.total), className: 'tabular-nums' },
    {
      header: 'Estado',
      render: (v) => (v.anulada ? <span className="text-danger">Anulada</span> : <span className="text-accent-2">Activa</span>),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltrosBar value={filtros} onChange={(f) => filtrar(() => setFiltros(f))} />
        <Select id="f-estado" label="Estado" value={estado} onChange={(e) => filtrar(() => setEstado(e.target.value as typeof estado))}>
          <option value="activas">Activas</option>
          <option value="anuladas">Anuladas</option>
          <option value="todas">Todas</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando ventas…
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.results ?? []}
            rowKey={(v) => v.id}
            emptyMessage="No hay ventas para estos filtros."
            onRowClick={setSeleccionada}
            error={error}
            onRetry={refetch}
          />
          <Paginacion
            pagina={pagina} porPagina={VENTAS_POR_PAGINA}
            total={data?.count ?? 0} onCambiar={setPagina}
          />
        </>
      )}

      {seleccionada === null ? null : <TicketDetalleModal venta={seleccionada} onClose={() => setSeleccionada(null)} />}
    </div>
  )
}
