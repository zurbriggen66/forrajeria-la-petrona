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
  const { data, isLoading } = useVentas(filtrosConEstado)

  /** Al cambiar un filtro hay que volver a la página 1: la página actual
   * puede no existir en el resultado filtrado. */
  function filtrar(cambio: () => void) {
    cambio()
    setPagina(1)
  }

  const columns: Column<Venta>[] = [
    { header: 'Ticket', render: (v) => `#${v.numero_ticket ?? '—'}` },
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
