import { useState } from 'react'
import { Bike, Package } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney, parseDecimal } from '../../lib/format'
import { crearVenta, useClientePorId } from '../pos/api'
import { CUENTA_CORRIENTE, PaymentPanel, type DatosCobro } from '../pos/PaymentPanel'
import { useCambiarEstadoReparto } from './api'
import type { Reparto } from './types'

/** Facturar un reparto entregado: arma la venta con sus ítems (nada de
 * re-tipear el pedido en el POS) y abre el mismo cobro de siempre.
 *
 * La venta que sale de acá es una venta real — descuenta stock, entra a caja y
 * aparece en las estadísticas — y queda linkeada al reparto, así no se puede
 * cobrar dos veces. El costo del envío entra como recargo: es plata que se
 * cobra y no es un producto.
 *
 * Existía el mismo modal para presupuestos y no para repartos: marcar
 * "entregado" no hacía nada más que cambiar el estado, y el cajero tenía que
 * volver a cargar todo el pedido a mano en el POS. */
export function RepartoCobrarModal({ reparto, onClose, onCobrado, marcarEntregado = true }: {
  reparto: Reparto
  onClose: () => void
  onCobrado: () => void
  /** false para cobrar un pedido que todavía no salió (el cliente pagó al
   * encargarlo). El reparto queda con su venta hecha pero sigue pendiente o en
   * camino: son dos cosas distintas y hasta ahora se confundían en una. */
  marcarEntregado?: boolean
}) {
  const { toast } = useToast()
  const { data: clienteVinculado } = useClientePorId(reparto.cliente)
  const cambiarEstado = useCambiarEstadoReparto()
  const [cobrando, setCobrando] = useState(false)

  const itemsValidos = reparto.items.filter((i) => i.producto !== null)
  const subtotal = itemsValidos.reduce((acc, i) => acc + Number(i.subtotal), 0)
  const envio = parseDecimal(reparto.costo_envio)

  async function handleCobrar(datos: DatosCobro) {
    setCobrando(true)
    try {
      const total = Math.max(subtotal - parseDecimal(datos.descuento) + parseDecimal(datos.recargoMonto), 0)
      const resultado = await crearVenta({
        items: itemsValidos.map((i) => ({ producto: i.producto!, cantidad: i.cantidad, es_bolsa: i.es_bolsa })),
        cliente: datos.cliente?.id ?? null,
        cuenta_pago: datos.cuentaPagoId || null,
        pagos: datos.pagos.length > 0 ? datos.pagos : undefined,
        metodo_pago: datos.cuentaCorriente ? 'cuenta_corriente' : datos.cuentaPagoId ? '' : 'efectivo',
        monto_cuenta_corriente: datos.cuentaCorriente ? String(total) : undefined,
        efectivo_recibido: datos.cuentaCorriente ? null : datos.efectivoRecibido || null,
        vuelto_cuenta_pago: datos.vueltoCuentaPagoId || null,
        descuento: datos.descuento,
        recargo_monto: datos.recargoMonto,
        origen: 'reparto',
      })

      if (resultado.status !== 'ok') {
        // Sin red la venta queda encolada y se sincroniza sola (useOfflineSync),
        // pero acá no hay id todavía para linkear el reparto: hay que reintentar
        // con conexión, o quedaría cobrado sin saber en qué venta terminó.
        toast('Sin conexión: la venta se guardó para sincronizar, pero el reparto no quedó facturado. Reintentá cuando vuelva internet.', 'error')
        return
      }

      await cambiarEstado.mutateAsync({
        id: reparto.id,
        estado: marcarEntregado ? 'entregado' : reparto.estado,
        venta: resultado.venta.id,
      })
      toast(
        marcarEntregado
          ? `Reparto facturado — ticket #${resultado.venta.numero_ticket}`
          : `Cobrado por adelantado — ticket #${resultado.venta.numero_ticket}. El repartidor no cobra nada.`,
      )
      onCobrado()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo facturar el reparto'), 'error')
    } finally {
      setCobrando(false)
    }
  }

  return (
    <Modal
      title={marcarEntregado
        ? `Facturar el reparto de ${reparto.cliente_nombre}`
        : `Cobrar por adelantado — ${reparto.cliente_nombre}`}
      onClose={onClose}
      ancho="xl"
    >
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-72 flex-1 flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs text-text-dim">
            <Bike size={13} className="shrink-0" /> {reparto.destino}
          </p>
          {!marcarEntregado && (
            <p className="rounded-lg border border-info/40 bg-info/10 px-2.5 py-1.5 text-xs text-info">
              El pedido se cobra ahora y sale después. Descuenta stock y entra a la caja hoy, y la hoja de
              reparto va a decir <span className="font-medium">NO COBRAR</span>.
            </p>
          )}
          <p className="text-xs text-text-dim">
            Los precios se cobran a los vigentes hoy, no a los del día en que se cargó el pedido.
            {envio > 0 && ' El costo del envío viene puesto como recargo — sacalo si esta vez no se lo cobrás.'}
          </p>
          {(reparto.a_cuenta_corriente || reparto.cuenta_pago_nombre) && (
            <p className="text-xs text-text-dim">
              Se cargó para cobrar{' '}
              <span className="text-text">
                {reparto.a_cuenta_corriente ? 'a cuenta corriente' : `con ${reparto.cuenta_pago_nombre}`}
              </span>
              , y así viene puesto abajo.
            </p>
          )}

          <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2/40 p-3">
            {itemsValidos.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-text-dim">
                  {Number(item.cantidad)}× {item.producto_nombre}
                  {item.es_bolsa && <span className="text-text-dim"> (bolsa)</span>}
                </span>
                <span className="shrink-0 tabular-nums text-text">{formatMoney(item.subtotal)}</span>
              </div>
            ))}
            {itemsValidos.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-warning">
                <Package size={14} /> Este reparto no tiene productos que sigan en el catálogo.
              </p>
            )}
            <div className="mt-1 flex justify-between border-t border-border pt-1.5 text-sm">
              <span className="text-text-dim">Productos</span>
              <span className="tabular-nums text-text">{formatMoney(subtotal)}</span>
            </div>
            {envio > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">Envío</span>
                <span className="tabular-nums text-text">{formatMoney(envio)}</span>
              </div>
            )}
          </div>
        </div>

        <PaymentPanel
          subtotal={subtotal}
          cobrando={cobrando}
          disabled={itemsValidos.length === 0}
          onCobrar={handleCobrar}
          clienteInicial={clienteVinculado ?? null}
          descuentoInicial={String(parseDecimal(reparto.descuento))}
          recargoInicial={String(envio)}
          // Lo que se decidió al cargar el pedido. Se puede cambiar acá: en la
          // puerta el cliente puede pagar de otra forma que la planeada.
          cuentaPagoInicial={reparto.a_cuenta_corriente ? CUENTA_CORRIENTE : (reparto.cuenta_pago ?? '')}
        />
      </div>
    </Modal>
  )
}
