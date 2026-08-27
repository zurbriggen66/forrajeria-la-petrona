import { useState } from 'react'
import { FileText, Loader2, Pencil, Receipt, Trash2, UserPlus, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { KpiCard } from '../../components/ui/KpiCard'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { PresupuestoFormModal } from '../presupuestos/PresupuestoFormModal'
import { usePresupuestos } from '../presupuestos/api'
import type { Presupuesto } from '../presupuestos/types'
import { useVendedores, useVentas } from '../ventas/api'
import { TicketDetalleModal } from '../ventas/TicketDetalleModal'
import type { Venta } from '../ventas/types'
import {
  useAsignacionesCliente,
  useAsignarVendedor,
  useDesactivarAsignacion,
  useEliminarCliente,
  useEliminarMovimientoCliente,
  useMovimientosCliente,
} from './api'
import { ClienteFormModal } from './ClienteFormModal'
import { ClienteMovimientoFormModal } from './ClienteMovimientoFormModal'
import type { Cliente, ClienteMovimiento } from './types'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

const COLOR_TIPO_MOVIMIENTO: Record<string, string> = {
  cargo: 'text-danger',
  pago: 'text-accent-2',
  ajuste: 'text-warning',
}

const LABEL_TIPO_MOVIMIENTO: Record<string, string> = {
  cargo: 'Cargo (venta fiada)',
  pago: 'Pago',
  ajuste: 'Ajuste',
}

const LABEL_MEDIO_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

function AsignacionVendedor({ cliente }: { cliente: Cliente }) {
  const { toast } = useToast()
  const { data: asignaciones } = useAsignacionesCliente(cliente.id)
  const { data: vendedores } = useVendedores()
  const asignarVendedor = useAsignarVendedor(cliente.id)
  const desactivar = useDesactivarAsignacion(cliente.id)
  const [seleccion, setSeleccion] = useState('')

  const activa = asignaciones?.find((a) => a.activo)

  async function handleAsignar() {
    if (!seleccion) return
    try {
      if (activa) await desactivar.mutateAsync(activa.id)
      await asignarVendedor.mutateAsync(seleccion)
      toast('Vendedor asignado')
      setSeleccion('')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo asignar el vendedor'), 'error')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-text">
        <UserPlus size={15} className="text-accent" /> Vendedor asignado
      </h3>
      {activa ? (
        <p className="mb-3 text-sm text-text-dim">
          Atendido por <span className="font-medium text-text">{activa.vendedor_nombre ?? 'Sin nombre'}</span>
        </p>
      ) : (
        <p className="mb-3 text-sm text-text-dim">Sin vendedor asignado.</p>
      )}
      <div className="flex gap-2">
        <Select
          id="select-vendedor-asignar" aria-label="Elegir vendedor"
          value={seleccion} onChange={(e) => setSeleccion(e.target.value)} className="flex-1"
        >
          <option value="">{activa ? 'Reasignar a…' : 'Elegí un vendedor…'}</option>
          {vendedores?.map((v) => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
        </Select>
        <Button
          type="button" onClick={handleAsignar}
          disabled={!seleccion || asignarVendedor.isPending || desactivar.isPending}
        >
          Asignar
        </Button>
      </div>
    </div>
  )
}

export function ClienteDetalleModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const { toast } = useToast()
  const [editando, setEditando] = useState(false)
  const [movimientoModo, setMovimientoModo] = useState<'pago' | 'ajuste' | null>(null)
  const [movimientoEditando, setMovimientoEditando] = useState<ClienteMovimiento | null>(null)
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null)
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState<Presupuesto | null>(null)

  const { data: movimientos, isLoading: cargandoMovimientos } = useMovimientosCliente(cliente.id)
  const { data: ventasData, isLoading: cargandoVentas } = useVentas({ cliente: cliente.id })
  // Sólo los aprobados: son los que el cliente ya aceptó, el resto (pendiente,
  // rechazado, vencido) todavía no es un compromiso y no pertenece acá.
  const { data: presupuestosAprobados, isLoading: cargandoPresupuestos } = usePresupuestos({
    cliente: cliente.id, estado: 'aprobado',
  })
  const eliminarMovimiento = useEliminarMovimientoCliente(cliente.id)
  const eliminarCliente = useEliminarCliente()

  const disponible = Number(cliente.limite_credito) - Number(cliente.saldo_actual)

  async function handleEliminarCliente() {
    const aviso = Number(cliente.saldo_actual) > 0
      ? `${cliente.nombre} tiene un saldo pendiente de ${formatMoney(cliente.saldo_actual)}. `
      : ''
    if (!window.confirm(`${aviso}¿Eliminar a ${cliente.nombre}? Sus ventas quedan en el historial, pero sin cliente asociado.`)) return
    try {
      await eliminarCliente.mutateAsync(cliente.id)
      toast('Cliente eliminado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo eliminar el cliente'), 'error')
    }
  }

  async function handleEliminar(m: ClienteMovimiento) {
    if (!window.confirm('¿Borrar este movimiento? El saldo del cliente se recalcula solo.')) return
    try {
      await eliminarMovimiento.mutateAsync(m.id)
      toast('Movimiento borrado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo borrar el movimiento'), 'error')
    }
  }

  const columnasMovimientos: Column<ClienteMovimiento>[] = [
    { header: 'Fecha', render: (m) => formatFecha(m.created_at) },
    { header: 'Tipo', render: (m) => <span className={COLOR_TIPO_MOVIMIENTO[m.tipo] ?? ''}>{LABEL_TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</span> },
    {
      header: 'Motivo',
      render: (m) => m.tipo === 'pago'
        ? [LABEL_MEDIO_PAGO[m.medio_pago] ?? null, m.referencia].filter(Boolean).join(' · ') || '—'
        : m.referencia || '—',
    },
    {
      header: 'Monto', className: 'tabular-nums text-right',
      render: (m) => (
        <span className={COLOR_TIPO_MOVIMIENTO[m.tipo] ?? ''}>
          {m.tipo === 'pago' ? '-' : '+'}{formatMoney(m.monto)}
        </span>
      ),
    },
    {
      header: '', className: 'text-right',
      render: (m) => m.tipo === 'cargo' ? null : (
        <div className="flex justify-end gap-2">
          <button onClick={() => setMovimientoEditando(m)} aria-label="Corregir" className="text-text-dim hover:text-accent">
            <Pencil size={13} />
          </button>
          <button onClick={() => handleEliminar(m)} aria-label="Borrar" className="text-text-dim hover:text-danger">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]

  const columnasVentas: Column<Venta>[] = [
    { header: 'Ticket', render: (v) => `#${v.numero_ticket ?? '—'}` },
    { header: 'Fecha', render: (v) => formatFecha(v.created_at) },
    { header: 'Total', render: (v) => formatMoney(v.total), className: 'tabular-nums' },
    {
      header: 'Fiado',
      className: 'tabular-nums',
      render: (v) => (Number(v.monto_cuenta_corriente) > 0 ? formatMoney(v.monto_cuenta_corriente) : '—'),
    },
    {
      header: 'Estado',
      render: (v) => (v.anulada ? <span className="text-danger">Anulada</span> : <span className="text-accent-2">Activa</span>),
    },
  ]

  const columnasPresupuestos: Column<Presupuesto>[] = [
    { header: 'Número', render: (p) => p.numero || 'Sin número' },
    { header: 'Fecha', render: (p) => formatFecha(p.created_at) },
    {
      header: 'Válido hasta',
      render: (p) => (p.validez ? formatFechaSola(p.validez) : '—'),
    },
    { header: 'Total', render: (p) => formatMoney(p.total), className: 'tabular-nums' },
  ]

  if (editando) {
    return <ClienteFormModal cliente={cliente} onClose={() => setEditando(false)} />
  }

  return (
    <Modal title={cliente.nombre} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-dim">
          <span>{cliente.telefono || cliente.celular || 'Sin teléfono'} · {cliente.email || 'sin email'}</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditando(true)} className="flex items-center gap-1 text-accent hover:underline">
              <Pencil size={13} /> Editar datos
            </button>
            <button
              onClick={handleEliminarCliente} disabled={eliminarCliente.isPending}
              className="flex items-center gap-1 text-danger hover:underline"
            >
              <Trash2 size={13} /> Eliminar cliente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <KpiCard label="Saldo (cuenta corriente)" value={formatMoney(cliente.saldo_actual)} icon={Wallet} accent={Number(cliente.saldo_actual) > 0 ? 'danger' : 'accent-2'} />
          <KpiCard label="Límite de crédito" value={formatMoney(cliente.limite_credito)} icon={Wallet} />
          <KpiCard label="Disponible" value={formatMoney(disponible)} icon={Wallet} accent={disponible < 0 ? 'danger' : 'accent-2'} />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setMovimientoModo('pago')}>Registrar pago</Button>
          <Button variant="secondary" onClick={() => setMovimientoModo('ajuste')}>Ajuste manual</Button>
        </div>

        <AsignacionVendedor cliente={cliente} />

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <Wallet size={15} className="text-accent" /> Movimientos de cuenta corriente
          </h3>
          {cargandoMovimientos ? (
            <div className="flex items-center gap-2 py-6 text-text-dim"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
          ) : (
            <Table columns={columnasMovimientos} rows={movimientos ?? []} rowKey={(m) => m.id} emptyMessage="Sin movimientos todavía." />
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <Receipt size={15} className="text-accent" /> Ventas de este cliente
          </h3>
          <p className="mb-2 text-xs text-text-dim">Tocá una fila para ver el detalle: qué se llevó, no sólo cuánto.</p>
          {cargandoVentas ? (
            <div className="flex items-center gap-2 py-6 text-text-dim"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
          ) : (
            <Table
              columns={columnasVentas}
              rows={ventasData?.results ?? []}
              rowKey={(v) => v.id}
              emptyMessage="Todavía no le vendiste nada."
              onRowClick={setVentaSeleccionada}
            />
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <FileText size={15} className="text-accent" /> Presupuestos aprobados
          </h3>
          {/* No son ventas todavía: sólo cotizó y el cliente dijo que sí. La
              venta real se carga en el POS cuando la viene a buscar. */}
          <p className="mb-2 text-xs text-text-dim">Tocá una fila para ver el detalle de lo cotizado.</p>
          {cargandoPresupuestos ? (
            <div className="flex items-center gap-2 py-6 text-text-dim"><Loader2 size={14} className="animate-spin" /> Cargando…</div>
          ) : (
            <Table
              columns={columnasPresupuestos}
              rows={presupuestosAprobados ?? []}
              rowKey={(p) => p.id}
              emptyMessage="Sin presupuestos aprobados todavía."
              onRowClick={setPresupuestoSeleccionado}
            />
          )}
        </div>
      </div>

      {movimientoModo && (
        <ClienteMovimientoFormModal clienteId={cliente.id} tipo={movimientoModo} onClose={() => setMovimientoModo(null)} />
      )}
      {movimientoEditando && (
        <ClienteMovimientoFormModal
          clienteId={cliente.id}
          tipo={movimientoEditando.tipo === 'pago' ? 'pago' : 'ajuste'}
          movimiento={movimientoEditando}
          onClose={() => setMovimientoEditando(null)}
        />
      )}
      {ventaSeleccionada && (
        <TicketDetalleModal venta={ventaSeleccionada} onClose={() => setVentaSeleccionada(null)} />
      )}
      {presupuestoSeleccionado && (
        <PresupuestoFormModal presupuesto={presupuestoSeleccionado} onClose={() => setPresupuestoSeleccionado(null)} />
      )}
    </Modal>
  )
}
