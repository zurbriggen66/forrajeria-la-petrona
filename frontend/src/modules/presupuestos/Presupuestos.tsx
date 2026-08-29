import { useEffect, useState } from 'react'
import {
  Check, Clock, DollarSign, FileText, Loader2, Package, Pencil, Plus, Printer, Search, Trash2, UserRound, X,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Input } from '../../components/ui/Input'
import { KpiCard } from '../../components/ui/KpiCard'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { imprimir } from '../../lib/imprimir'
import { HojaPresupuesto } from './HojaPresupuesto'
import { PresupuestoCobrarModal } from './PresupuestoCobrarModal'
import { PresupuestoFormModal } from './PresupuestoFormModal'
import { useCambiarEstadoPresupuesto, useDeletePresupuesto, usePresupuestos } from './api'
import { ESTADOS, type EstadoPresupuesto, type Presupuesto, type PresupuestoFiltros } from './types'

const ESTILO_ESTADO: Record<EstadoPresupuesto, string> = {
  pendiente: 'border-warning/40 bg-warning/10 text-warning',
  aprobado: 'border-accent-2/40 bg-accent-2/10 text-accent-2',
  cobrado: 'border-accent/40 bg-accent/10 text-accent',
  rechazado: 'border-danger/40 bg-danger/10 text-danger',
  vencido: 'border-border bg-surface-2 text-text-dim',
}

const LABEL_ESTADO: Record<EstadoPresupuesto, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  cobrado: 'Cobrado',
  rechazado: 'Rechazado',
  vencido: 'Vencido',
}

function TarjetaPresupuesto({
  presupuesto, onEditar, onImprimir, onCambiarEstado, onCobrar, onEliminar,
}: {
  presupuesto: Presupuesto
  onEditar: () => void
  onImprimir: () => void
  onCambiarEstado: (estado: EstadoPresupuesto) => void
  onCobrar: () => void
  onEliminar: () => void
}) {
  const editable = presupuesto.estado === 'pendiente'
  const cobrable = presupuesto.estado === 'aprobado'

  return (
    <div className="tarjeta-viva flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text">{presupuesto.cliente_nombre}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ESTILO_ESTADO[presupuesto.estado]}`}>
              {LABEL_ESTADO[presupuesto.estado]}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-dim">
            <FileText size={13} className="shrink-0 text-accent" />
            <span className="truncate">{presupuesto.numero || 'Sin número'}</span>
          </p>
          {presupuesto.validez && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-dim">
              <Clock size={12} /> Válido hasta {formatFechaSola(presupuesto.validez)}
            </p>
          )}
          {presupuesto.cliente_registrado_nombre && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-accent-2">
              <UserRound size={12} /> Cliente registrado
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-lg font-semibold tabular-nums text-text">{formatMoney(presupuesto.total)}</div>
          <div className="text-xs text-text-dim">{new Date(presupuesto.created_at).toLocaleDateString('es-AR')}</div>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-lg bg-surface-2/60 p-2.5 text-xs">
        {presupuesto.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-text-dim">
              <Package size={11} className="shrink-0" />
              <span className="truncate">
                {Number(item.cantidad)}
                {item.es_bolsa ? ` bolsa${Number(item.cantidad) === 1 ? '' : 's'}` : ` ${item.unidad_medida ?? ''}`}
                {' · '}{item.producto_nombre ?? 'Producto eliminado'}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-text-dim">{formatMoney(item.subtotal)}</span>
          </div>
        ))}
        {Number(presupuesto.descuento) > 0 && (
          <div className="mt-1 flex gap-3 border-t border-border pt-1.5 text-[11px] text-danger">
            Desc. −{formatMoney(presupuesto.descuento)}
          </div>
        )}
      </div>

      {presupuesto.notas && <p className="text-xs italic text-text-dim">“{presupuesto.notas}”</p>}

      {presupuesto.estado === 'cobrado' && presupuesto.venta_numero_ticket && (
        <p className="flex items-center gap-1.5 text-xs text-accent">
          <Check size={12} /> Cobrado — ticket #{presupuesto.venta_numero_ticket}
        </p>
      )}

      <div className="flex items-center gap-2">
        {editable && (
          <>
            <Button onClick={() => onCambiarEstado('aprobado')} className="!px-3 !py-1.5 text-xs">
              <Check size={13} /> Marcar aprobado
            </Button>
            <Button variant="ghost" onClick={() => onCambiarEstado('rechazado')} className="!px-2 !py-1.5 text-xs">
              <X size={13} /> Rechazar
            </Button>
          </>
        )}
        {cobrable && (
          <Button onClick={onCobrar} className="!px-3 !py-1.5 text-xs">
            <DollarSign size={13} /> Cobrar
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onImprimir} className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Imprimir presupuesto de ${presupuesto.cliente_nombre}`}>
            <Printer size={14} />
          </button>
          <button onClick={onEditar} className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Editar presupuesto de ${presupuesto.cliente_nombre}`}>
            <Pencil size={14} />
          </button>
          <button onClick={onEliminar} className="rounded p-1.5 text-text-dim hover:bg-danger/10 hover:text-danger" aria-label={`Eliminar presupuesto de ${presupuesto.cliente_nombre}`}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Presupuestos() {
  const { toast } = useToast()
  const [filtros, setFiltros] = useState<PresupuestoFiltros>({})
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<'nuevo' | Presupuesto | null>(null)
  const [aCobrar, setACobrar] = useState<Presupuesto | null>(null)
  const [aEliminar, setAEliminar] = useState<Presupuesto | null>(null)
  // Una sola hoja montada por vez: window.print() imprime TODO lo que esté en
  // .hoja-impresion, así que tener varias montadas saldría todo junto.
  const [aImprimir, setAImprimir] = useState<Presupuesto | null>(null)

  useEffect(() => {
    if (!aImprimir) return
    // Un frame de espera: print() bloquea, y llamado en el mismo ciclo la hoja
    // todavía no está pintada. Al terminar se desmonta, para que volver a
    // imprimir lo mismo dispare el efecto de nuevo.
    const id = requestAnimationFrame(() => {
      imprimir()
      setAImprimir(null)
    })
    return () => cancelAnimationFrame(id)
  }, [aImprimir])

  const { data: presupuestos, isLoading } = usePresupuestos({ ...filtros, search: busqueda || undefined })
  const cambiarEstado = useCambiarEstadoPresupuesto()
  const eliminar = useDeletePresupuesto()

  const pendientes = (presupuestos ?? []).filter((p) => p.estado === 'pendiente')
  const cotizadoPendiente = pendientes.reduce((acc, p) => acc + Number(p.total), 0)
  const aprobados = (presupuestos ?? []).filter((p) => p.estado === 'aprobado')
  const valorAprobado = aprobados.reduce((acc, p) => acc + Number(p.total), 0)

  async function handleCambiarEstado(presupuesto: Presupuesto, estado: EstadoPresupuesto) {
    try {
      await cambiarEstado.mutateAsync({ id: presupuesto.id, estado })
      toast(`Presupuesto de ${presupuesto.cliente_nombre}: ${LABEL_ESTADO[estado].toLowerCase()}`)
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cambiar el estado'), 'error')
    }
  }

  async function handleEliminar(presupuesto: Presupuesto) {
    try {
      await eliminar.mutateAsync(presupuesto.id)
      toast('Presupuesto eliminado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo eliminar el presupuesto'), 'error')
    } finally {
      setAEliminar(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Presupuestos pendientes" value={String(pendientes.length)} icon={Clock} accent="accent" />
        <KpiCard label="Cotizado sin responder" value={formatMoney(cotizadoPendiente)} icon={FileText} accent="accent-2" />
        <KpiCard label="Aprobado (a facturar)" value={formatMoney(valorAprobado)} icon={Check} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <Input
            id="buscar-presupuesto" placeholder="Buscar por cliente o número…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFiltros((f) => ({ ...f, estado: undefined }))}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              !filtros.estado ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
            }`}
          >
            Todos
          </button>
          {ESTADOS.map((e) => (
            <button
              key={e.value}
              onClick={() => setFiltros((f) => ({ ...f, estado: e.value }))}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                filtros.estado === e.value ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setModal('nuevo')} className="shrink-0">
          <Plus size={15} /> Nuevo presupuesto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando presupuestos…
        </div>
      ) : (presupuestos ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-16 text-text-dim">
          <FileText size={28} />
          <p className="text-sm">
            {busqueda || filtros.estado ? 'No hay presupuestos con ese filtro.' : 'Todavía no cargaste ningún presupuesto.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {presupuestos!.map((p) => (
            <TarjetaPresupuesto
              key={p.id}
              presupuesto={p}
              onEditar={() => setModal(p)}
              onImprimir={() => setAImprimir(p)}
              onCambiarEstado={(estado) => handleCambiarEstado(p, estado)}
              onCobrar={() => setACobrar(p)}
              onEliminar={() => setAEliminar(p)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-text-dim">
        Los presupuestos no descuentan stock ni entran a la caja: son una cotización. Cuando el
        cliente acepta, "Cobrar" arma la venta con los mismos ítems y la registra de verdad.
      </p>

      {aImprimir && <HojaPresupuesto presupuesto={aImprimir} />}

      {modal && (
        <PresupuestoFormModal
          presupuesto={modal === 'nuevo' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}

      {aEliminar && (
        <ConfirmDialog
          titulo="Eliminar presupuesto"
          descripcion={`Se va a borrar el presupuesto de "${aEliminar.cliente_nombre}". No se puede deshacer.`}
          confirmarTexto="Eliminar" peligro
          cargando={eliminar.isPending}
          onConfirmar={() => handleEliminar(aEliminar)}
          onCancelar={() => setAEliminar(null)}
        />
      )}

      {aCobrar && (
        <PresupuestoCobrarModal
          presupuesto={aCobrar}
          onClose={() => setACobrar(null)}
          onCobrado={() => setACobrar(null)}
        />
      )}
    </div>
  )
}
