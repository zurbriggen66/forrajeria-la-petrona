import { useState } from 'react'
import { FileText, History, Loader2, MessageCircle, Pencil, Receipt, Trash2, UserPlus, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
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
import { RegistroCambios } from './RegistroCambios'
import { linkWhatsapp } from '../../lib/whatsapp'
import { useAuth } from '../../context/AuthContext'
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

/** Abre WhatsApp con un mensaje ya escrito sobre ESTA venta.
 *
 * No manda nada solo: el envío automático del backend depende del bot, que casi
 * siempre está apagado. Esto le deja el mensaje armado al dueño para que lo
 * mande —o lo edite— cuando quiere. Es el caso real de reclamar un fiado.
 *
 * Se apaga si el cliente no tiene celular cargado: mejor un botón gris que uno
 * que abre una pestaña a la nada. */
function BotonWhatsapp({ cliente, venta }: { cliente: Cliente; venta: Venta }) {
  const { comercio } = useAuth()
  const fiado = Number(venta.monto_cuenta_corriente) > 0

  // formatMoney y no toLocaleString a mano: el mensaje que ve el cliente tiene
  // que mostrar la plata igual que la pantalla.
  const lineas = [
    `Hola ${cliente.nombre}, te escribo de ${comercio?.nombre ?? 'el local'}.`,
    '',
    `Compra del ${formatFecha(venta.created_at)}${venta.numero_ticket ? ` (ticket #${venta.numero_ticket})` : ''}`,
    `Total: ${formatMoney(venta.total)}`,
    fiado ? `Quedó en cuenta: ${formatMoney(venta.monto_cuenta_corriente)}` : '',
    '',
    `Tu saldo actual es de ${formatMoney(cliente.saldo_actual)}.`,
  ]
  const mensaje = lineas.filter((l, i) => l !== '' || i > 0).join(String.fromCharCode(10))

  const href = linkWhatsapp(cliente.celular || cliente.telefono, mensaje)

  if (!href) {
    return (
      <span
        title="Este cliente no tiene celular cargado en su ficha"
        className="inline-flex cursor-not-allowed rounded-md p-1.5 text-text-dim opacity-40"
      >
        <MessageCircle size={15} />
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      // stopPropagation: la fila abre el detalle de la venta al clickearla, y
      // el botón no tiene que disparar las dos cosas.
      onClick={(e) => e.stopPropagation()}
      title={`Escribirle por WhatsApp sobre esta compra${fiado ? ' (quedó fiada)' : ''}`}
      className="inline-flex rounded-md p-1.5 text-text-dim transition-colors hover:bg-accent-2/10 hover:text-accent-2"
    >
      <MessageCircle size={15} />
    </a>
  )
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
    <div className="tarjeta-viva rounded-xl border border-border bg-surface p-4">
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
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [movimientoAEliminar, setMovimientoAEliminar] = useState<ClienteMovimiento | null>(null)

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
    try {
      await eliminarCliente.mutateAsync(cliente.id)
      toast('Cliente eliminado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo eliminar el cliente'), 'error')
    } finally {
      setConfirmarBaja(false)
    }
  }

  async function handleEliminar(m: ClienteMovimiento, motivo: string) {
    try {
      await eliminarMovimiento.mutateAsync({ id: m.id, motivo })
      toast('Movimiento borrado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo borrar el movimiento'), 'error')
    } finally {
      setMovimientoAEliminar(null)
    }
  }

  const columnasMovimientos: Column<ClienteMovimiento>[] = [
    { header: 'Fecha', render: (m) => formatFecha(m.created_at) },
    { header: 'Tipo', render: (m) => <span className={COLOR_TIPO_MOVIMIENTO[m.tipo] ?? ''}>{LABEL_TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</span> },
    {
      header: 'Motivo',
      render: (m) => (
        <span className="flex items-center gap-1.5">
          {m.tipo === 'pago'
            ? [LABEL_MEDIO_PAGO[m.medio_pago] ?? null, m.referencia].filter(Boolean).join(' · ') || '—'
            : m.referencia || '—'}
          {/* Un pago que no entró a ninguna caja es plata cobrada que el arqueo
              del turno no vio. Se avisa acá, que es donde se mira. */}
          {m.tipo === 'pago' && !m.caja_sesion && (
            <span
              title="Se cobró sin caja abierta: no está en el arqueo de ningún turno"
              className="rounded-full border border-warning/40 bg-warning/10 px-1.5 text-[10px] font-medium text-warning"
            >
              fuera de caja
            </span>
          )}
        </span>
      ),
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
          <button onClick={() => setMovimientoAEliminar(m)} aria-label="Borrar" className="text-text-dim hover:text-danger">
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
    {
      header: '',
      className: 'text-right',
      render: (v) => <BotonWhatsapp cliente={cliente} venta={v} />,
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
    <Modal title={cliente.nombre} onClose={onClose} ancho="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-dim">
          <span>{cliente.telefono || cliente.celular || 'Sin teléfono'} · {cliente.email || 'sin email'}</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditando(true)} className="flex items-center gap-1 text-accent hover:underline">
              <Pencil size={13} /> Editar datos
            </button>
            <button
              onClick={() => setConfirmarBaja(true)} disabled={eliminarCliente.isPending}
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

        {/* Cuenta corriente primero: es lo que el dueño viene a mirar más
            seguido a esta ficha (cuánto debe, cuándo pagó) — antes que
            vendedor, ventas o presupuestos. */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setMovimientoModo('pago')}>Registrar pago</Button>
          <Button variant="secondary" onClick={() => setMovimientoModo('ajuste')}>Ajuste manual</Button>
        </div>

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

        {/* Va pegado a los movimientos y no en otra pantalla: cuando el cliente
            discute un saldo, la pregunta y la respuesta tienen que estar juntas. */}
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
            <History size={15} className="text-accent" /> Registro de cambios
          </h3>
          <RegistroCambios clienteId={cliente.id} />
        </div>

        <AsignacionVendedor cliente={cliente} />

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
      {confirmarBaja && (
        <ConfirmDialog
          titulo={`Eliminar a ${cliente.nombre}`}
          descripcion={`${Number(cliente.saldo_actual) > 0
            ? `Tiene un saldo pendiente de ${formatMoney(cliente.saldo_actual)}. `
            : ''}Sus ventas quedan en el historial, pero sin cliente asociado.`}
          confirmarTexto="Eliminar cliente" peligro
          cargando={eliminarCliente.isPending}
          onConfirmar={handleEliminarCliente}
          onCancelar={() => setConfirmarBaja(false)}
        />
      )}
      {movimientoAEliminar && (
        <ConfirmDialog
          titulo="Borrar movimiento"
          descripcion="El saldo del cliente se recalcula solo al borrarlo. No se puede deshacer, pero queda en el registro de cambios."
          confirmarTexto="Borrar" peligro
          cargando={eliminarMovimiento.isPending}
          pedirMotivo={{
            label: 'Por qué lo borrás',
            placeholder: 'Ej: el pago era de otro cliente',
          }}
          onConfirmar={(motivo) => handleEliminar(movimientoAEliminar, motivo)}
          onCancelar={() => setMovimientoAEliminar(null)}
        />
      )}
      {presupuestoSeleccionado && (
        <PresupuestoFormModal presupuesto={presupuestoSeleccionado} onClose={() => setPresupuestoSeleccionado(null)} />
      )}
    </Modal>
  )
}
