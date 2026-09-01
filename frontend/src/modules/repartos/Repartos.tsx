import { useEffect, useState } from 'react'
import {
  Check, DollarSign, Loader2, MapPin, Package, Pencil, Phone, Plus, Printer, Search, Trash2, Truck, X,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { HojaReparto, HojaRutaDelDia } from './HojaReparto'
import { Input } from '../../components/ui/Input'
import { KpiCard } from '../../components/ui/KpiCard'
import { useToast } from '../../context/ToastContext'
import { imprimir } from '../../lib/imprimir'
import { extraerMensajeError } from '../../lib/errors'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { RepartoCobrarModal } from './RepartoCobrarModal'
import { RepartoFormModal } from './RepartoFormModal'
import { useCambiarEstadoReparto, useDeleteReparto, useRepartos } from './api'
import { ESTADOS, type EstadoReparto, type Reparto, type RepartoFiltros } from './types'

const ESTILO_ESTADO: Record<EstadoReparto, string> = {
  pendiente: 'border-warning/40 bg-warning/10 text-warning',
  en_camino: 'border-accent/40 bg-accent/10 text-accent',
  entregado: 'border-accent-2/40 bg-accent-2/10 text-accent-2',
  cancelado: 'border-border bg-surface-2 text-text-dim',
}

const LABEL_ESTADO: Record<EstadoReparto, string> = {
  pendiente: 'Pendiente',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/** Próximo paso natural del reparto — el botón que el cliente va a apretar el
 * 90% de las veces, sin tener que abrir un menú de estados. */
const SIGUIENTE: Partial<Record<EstadoReparto, { estado: EstadoReparto; label: string }>> = {
  pendiente: { estado: 'en_camino', label: 'Marcar en camino' },
  // "Entregar y facturar": entregar es cuando la mercadería sale de verdad, así
  // que es cuando tiene que descontar stock y existir la venta. Antes marcaba
  // el estado y nada más, y el pedido había que re-tipearlo entero en el POS.
  en_camino: { estado: 'entregado', label: 'Entregar y facturar' },
}

function TarjetaReparto({
  reparto, onEditar, onCambiarEstado, onEliminar, onImprimir, onFacturar,
}: {
  reparto: Reparto
  onEditar: () => void
  onCambiarEstado: (estado: EstadoReparto) => void
  onFacturar: () => void
  onEliminar: () => void
  onImprimir: () => void
}) {
  const siguiente = SIGUIENTE[reparto.estado]

  return (
    <div className="tarjeta-viva flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text">{reparto.cliente_nombre}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ESTILO_ESTADO[reparto.estado]}`}>
              {LABEL_ESTADO[reparto.estado]}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-dim">
            <MapPin size={13} className="shrink-0 text-accent" />
            <span className="truncate">{reparto.destino}</span>
          </p>
          {reparto.telefono && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-dim">
              <Phone size={12} /> {reparto.telefono}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-lg font-semibold tabular-nums text-text">{formatMoney(reparto.total)}</div>
          <div className="text-xs text-text-dim">{formatFechaSola(reparto.fecha)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-lg bg-surface-2/60 p-2.5 text-xs">
        {reparto.items.map((item) => (
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
        {(Number(reparto.costo_envio) > 0 || Number(reparto.descuento) > 0) && (
          <div className="mt-1 flex gap-3 border-t border-border pt-1.5 text-[11px] text-text-dim">
            {Number(reparto.costo_envio) > 0 && (
              <span className="flex items-center gap-1"><Truck size={11} /> Envío {formatMoney(reparto.costo_envio)}</span>
            )}
            {Number(reparto.descuento) > 0 && <span className="text-danger">Desc. −{formatMoney(reparto.descuento)}</span>}
          </div>
        )}
      </div>

      {reparto.notas && <p className="text-xs italic text-text-dim">“{reparto.notas}”</p>}

      {/* Un reparto entregado sin venta linkeada es plata entregada que no
          entró a ningún lado: hay que poder facturarlo desde acá. */}
      {reparto.estado === 'entregado' && !reparto.venta && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-xs text-warning">
          Entregado pero sin facturar: no descontó stock ni entró a caja.
        </p>
      )}
      {reparto.venta_numero_ticket && (
        <p className="text-xs text-accent-2">Facturado — ticket #{reparto.venta_numero_ticket}</p>
      )}

      <div className="flex items-center gap-2">
        {siguiente && (
          <Button onClick={() => onCambiarEstado(siguiente.estado)} className="!px-3 !py-1.5 text-xs">
            <Check size={13} /> {siguiente.label}
          </Button>
        )}
        {reparto.estado === 'entregado' && !reparto.venta && (
          <Button onClick={onFacturar} className="!px-3 !py-1.5 text-xs">
            <DollarSign size={13} /> Facturar
          </Button>
        )}
        {reparto.estado !== 'cancelado' && reparto.estado !== 'entregado' && (
          <Button variant="ghost" onClick={() => onCambiarEstado('cancelado')} className="!px-2 !py-1.5 text-xs">
            <X size={13} /> Cancelar
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onImprimir} className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Imprimir hoja de ${reparto.cliente_nombre}`}>
            <Printer size={14} />
          </button>
          <button onClick={onEditar} className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Editar reparto de ${reparto.cliente_nombre}`}>
            <Pencil size={14} />
          </button>
          <button onClick={onEliminar} className="rounded p-1.5 text-text-dim hover:bg-danger/10 hover:text-danger" aria-label={`Eliminar reparto de ${reparto.cliente_nombre}`}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function Repartos() {
  const { toast } = useToast()
  const [filtros, setFiltros] = useState<RepartoFiltros>({})
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<'nuevo' | Reparto | null>(null)
  const [aEliminar, setAEliminar] = useState<Reparto | null>(null)
  const [aFacturar, setAFacturar] = useState<Reparto | null>(null)
  // Una sola hoja montada por vez: window.print() imprime TODO lo que esté en
  // .hoja-impresion, así que tener varias montadas saldría todo junto.
  const [aImprimir, setAImprimir] = useState<Reparto | 'ruta' | null>(null)

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

  const { data: repartos, isLoading } = useRepartos({ ...filtros, search: busqueda || undefined })
  const cambiarEstado = useCambiarEstadoReparto()
  const eliminar = useDeleteReparto()

  const activos = (repartos ?? []).filter((r) => r.estado === 'pendiente' || r.estado === 'en_camino')
  const aCobrar = activos.reduce((acc, r) => acc + Number(r.total), 0)
  const enviosDelDia = (repartos ?? [])
    .filter((r) => r.estado !== 'cancelado')
    .reduce((acc, r) => acc + Number(r.costo_envio), 0)

  async function handleCambiarEstado(reparto: Reparto, estado: EstadoReparto) {
    // Entregar abre el cobro derecho: es el momento en que la mercadería sale y
    // tiene que descontar stock. Si cierran el modal queda entregado sin
    // facturar, con el aviso en la tarjeta y el botón "Facturar" a mano.
    if (estado === 'entregado' && !reparto.venta) {
      setAFacturar(reparto)
      return
    }
    try {
      await cambiarEstado.mutateAsync({ id: reparto.id, estado })
      toast(`Reparto de ${reparto.cliente_nombre}: ${LABEL_ESTADO[estado].toLowerCase()}`)
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cambiar el estado'), 'error')
    }
  }

  async function handleEliminar(reparto: Reparto) {
    try {
      await eliminar.mutateAsync(reparto.id)
      toast('Reparto eliminado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo eliminar el reparto'), 'error')
    } finally {
      setAEliminar(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Repartos activos" value={String(activos.length)} icon={Truck} accent="accent" />
        <KpiCard label="A cobrar en la calle" value={formatMoney(aCobrar)} icon={Package} accent="accent-2" />
        <KpiCard label="Cobrado por envíos" value={formatMoney(enviosDelDia)} icon={Truck} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <Input
            id="buscar-reparto" placeholder="Buscar por cliente o dirección…"
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
        <Button
          variant="secondary" className="shrink-0"
          onClick={() => setAImprimir('ruta')}
          disabled={activos.length === 0}
          title="Todas las entregas pendientes en un solo papel, para el repartidor"
        >
          <Printer size={15} /> Hoja de ruta
        </Button>
        <Button onClick={() => setModal('nuevo')} className="shrink-0">
          <Plus size={15} /> Nuevo reparto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando repartos…
        </div>
      ) : (repartos ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-16 text-text-dim">
          <Truck size={28} />
          <p className="text-sm">
            {busqueda || filtros.estado ? 'No hay repartos con ese filtro.' : 'Todavía no cargaste ningún reparto.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {repartos!.map((r) => (
            <TarjetaReparto
              key={r.id}
              reparto={r}
              onImprimir={() => setAImprimir(r)}
              onEditar={() => setModal(r)}
              onCambiarEstado={(estado) => handleCambiarEstado(r, estado)}
              onEliminar={() => setAEliminar(r)}
              onFacturar={() => setAFacturar(r)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-text-dim">
        Un reparto pendiente o en camino es la hoja de ruta: no descuenta stock ni entra a la caja, porque
        la mercadería todavía no salió. Al <span className="text-text">entregarlo</span> se factura — ahí
        se crea la venta con sus productos y el envío, descuenta stock y entra a caja.
      </p>

      {/* Invisible en pantalla: sólo existe para el papel (ver .hoja-impresion). */}
      {aImprimir === 'ruta' && (
        <HojaRutaDelDia repartos={activos} fecha={activos[0]?.fecha ?? new Date().toISOString().slice(0, 10)} />
      )}
      {aImprimir && aImprimir !== 'ruta' && <HojaReparto reparto={aImprimir} />}

      {aFacturar && (
        <RepartoCobrarModal
          reparto={aFacturar}
          onClose={() => setAFacturar(null)}
          onCobrado={() => setAFacturar(null)}
        />
      )}

      {aEliminar && (
        <ConfirmDialog
          titulo="Eliminar reparto"
          descripcion={`Se va a borrar el reparto de "${aEliminar.cliente_nombre}" a ${aEliminar.destino}. No se puede deshacer.`}
          confirmarTexto="Eliminar" peligro
          cargando={eliminar.isPending}
          onConfirmar={() => handleEliminar(aEliminar)}
          onCancelar={() => setAEliminar(null)}
        />
      )}

      {modal && (
        <RepartoFormModal
          reparto={modal === 'nuevo' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
