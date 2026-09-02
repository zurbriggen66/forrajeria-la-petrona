import { useEffect, useState } from 'react'
import {
  Check, DollarSign, Loader2, MapPin, Package, Pencil, Phone, Plus, Printer, Search, Trash2, Truck,
  UserRound, Wallet, X,
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

/** Semáforo del reparto: de un vistazo, en qué anda cada pedido.
 *
 * Son CINCO y no cuatro porque "entregado" esconde dos situaciones muy
 * distintas: uno facturado está cerrado, y uno entregado sin facturar es
 * mercadería que salió y plata que no entró — el que más hay que mirar y el
 * único que la pantalla no distinguía.
 *
 * Los colores son fijos y no salen de --color-accent, que el comercio elige en
 * Config: un semáforo que cambia de color con la marca deja de ser un
 * semáforo. Verde, ámbar y rojo ya significan lo mismo en toda la app. */
type Semaforo = 'pendiente' | 'en_camino' | 'pagado_sin_entregar' | 'sin_facturar' | 'facturado' | 'cancelado'

const SEMAFORO: Record<Semaforo, {
  label: string
  /** Qué significa, para la referencia de arriba y el title de la tarjeta. */
  ayuda: string
  /** La tarjeta entera, no sólo la etiqueta: es lo que se ve a un metro. */
  tarjeta: string
  chip: string
  punto: string
}> = {
  pendiente: {
    label: 'Pendiente',
    ayuda: 'Cargado, todavía no salió',
    tarjeta: 'border-warning/40 bg-warning/[0.06]',
    chip: 'border-warning/40 bg-warning/10 text-warning',
    punto: 'bg-warning',
  },
  en_camino: {
    label: 'En camino',
    ayuda: 'Salió a la calle',
    tarjeta: 'border-info/45 bg-info/[0.07]',
    chip: 'border-info/40 bg-info/10 text-info',
    punto: 'bg-info',
  },
  pagado_sin_entregar: {
    label: 'Pagado, falta entregar',
    ayuda: 'Ya se cobró: el repartidor NO cobra nada',
    tarjeta: 'border-listo/45 bg-listo/[0.07]',
    chip: 'border-listo/45 bg-listo/10 text-listo',
    punto: 'bg-listo',
  },
  sin_facturar: {
    label: 'Sin facturar',
    ayuda: 'Entregado, pero no descontó stock ni entró a caja',
    tarjeta: 'border-danger/50 bg-danger/[0.07]',
    chip: 'border-danger/50 bg-danger/10 text-danger',
    punto: 'bg-danger',
  },
  facturado: {
    label: 'Facturado',
    ayuda: 'Entregado y cobrado: cerrado',
    tarjeta: 'border-accent-2/40 bg-accent-2/[0.06]',
    chip: 'border-accent-2/40 bg-accent-2/10 text-accent-2',
    punto: 'bg-accent-2',
  },
  cancelado: {
    label: 'Cancelado',
    ayuda: 'No se entrega',
    tarjeta: 'border-border bg-surface opacity-70',
    chip: 'border-border bg-surface-2 text-text-dim',
    punto: 'bg-text-dim',
  },
}

/** El estado del modelo más el dato que falta: si ya generó su venta. */
function semaforoDe(reparto: Reparto): Semaforo {
  if (reparto.estado === 'cancelado') return 'cancelado'
  if (reparto.estado === 'entregado') return reparto.venta ? 'facturado' : 'sin_facturar'
  // Estado de entrega y cobro son dos ejes distintos: un pedido puede estar
  // pago y todavía no haber salido. Confundirlo con "pendiente" es lo que hace
  // que el repartidor lo cobre dos veces.
  if (reparto.venta) return 'pagado_sin_entregar'
  return reparto.estado === 'en_camino' ? 'en_camino' : 'pendiente'
}

const LABEL_ESTADO: Record<EstadoReparto, string> = {
  pendiente: 'Pendiente',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/** Referencia de colores. Va arriba de la lista y no en un tooltip: si hay que
 * pasar el mouse para saber qué significa el color, el semáforo no sirve. */
function ReferenciaSemaforo() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
      {(Object.keys(SEMAFORO) as Semaforo[]).map((clave) => (
        <span key={clave} className="flex items-center gap-1.5 text-text-dim">
          <span className={`h-2 w-2 shrink-0 rounded-full ${SEMAFORO[clave].punto}`} />
          <span className="text-text">{SEMAFORO[clave].label}</span>
          <span>· {SEMAFORO[clave].ayuda}</span>
        </span>
      ))}
    </div>
  )
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
  reparto, onEditar, onCambiarEstado, onEliminar, onImprimir, onFacturar, onCobrarAhora,
}: {
  reparto: Reparto
  onEditar: () => void
  onCambiarEstado: (estado: EstadoReparto) => void
  onFacturar: () => void
  onCobrarAhora: () => void
  onEliminar: () => void
  onImprimir: () => void
}) {
  const semaforo = SEMAFORO[semaforoDe(reparto)]
  const paso = SIGUIENTE[reparto.estado]
  // Ya cobrado: entregar es sólo entregar, no hay nada que facturar.
  const siguiente = paso && reparto.venta && paso.estado === 'entregado'
    ? { ...paso, label: 'Marcar entregado' }
    : paso

  return (
    <div
      title={semaforo.ayuda}
      className={`tarjeta-viva flex flex-col gap-3 rounded-xl border p-4 ${semaforo.tarjeta}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text">{reparto.cliente_nombre}</span>
            <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${semaforo.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${semaforo.punto}`} />
              {semaforo.label}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-dim">
            <MapPin size={13} className="shrink-0 text-accent" />
            <span className="truncate">{reparto.destino}</span>
          </p>
          {/* Con qué se cobra: el repartidor tiene que salir sabiéndolo, y el
              que arma la hoja de ruta tiene que verlo sin abrir el pedido. */}
          {(reparto.a_cuenta_corriente || reparto.cuenta_pago_nombre) && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-dim">
              {reparto.a_cuenta_corriente ? <UserRound size={12} /> : <Wallet size={12} />}
              {reparto.a_cuenta_corriente
                ? <span className="text-warning">A cuenta corriente — no cobrar</span>
                : <>Cobrar con <span className="text-text">{reparto.cuenta_pago_nombre}</span></>}
            </p>
          )}
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
        {/* Pagó al encargarlo: se cobra ahora y sale después. */}
        {!reparto.venta && (reparto.estado === 'pendiente' || reparto.estado === 'en_camino') && (
          <Button variant="secondary" onClick={onCobrarAhora} className="!px-3 !py-1.5 text-xs">
            <DollarSign size={13} /> Ya pagó
          </Button>
        )}
        {reparto.estado !== 'cancelado' && reparto.estado !== 'entregado' && (
          <Button variant="ghost" onClick={() => onCambiarEstado('cancelado')} className="!px-2 !py-1.5 text-xs">
            <X size={13} /> Cancelar
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onImprimir} className="rounded-md p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Imprimir hoja de ${reparto.cliente_nombre}`}>
            <Printer size={14} />
          </button>
          <button onClick={onEditar} className="rounded-md p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Editar reparto de ${reparto.cliente_nombre}`}>
            <Pencil size={14} />
          </button>
          <button onClick={onEliminar} className="rounded-md p-1.5 text-text-dim hover:bg-danger/10 hover:text-danger" aria-label={`Eliminar reparto de ${reparto.cliente_nombre}`}>
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
  // Distinto de aFacturar: acá el pedido se cobra pero NO se marca entregado.
  const [aCobrarAhora, setACobrarAhora] = useState<Reparto | null>(null)
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
        <>
        <ReferenciaSemaforo />
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
              onCobrarAhora={() => setACobrarAhora(r)}
            />
          ))}
        </div>
        </>
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

      {aCobrarAhora && (
        <RepartoCobrarModal
          reparto={aCobrarAhora}
          marcarEntregado={false}
          onClose={() => setACobrarAhora(null)}
          onCobrado={() => setACobrarAhora(null)}
        />
      )}

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
