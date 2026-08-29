import { useState } from 'react'
import { Package } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { crearVenta, useClientePorId } from '../pos/api'
import { PaymentPanel, type DatosCobro } from '../pos/PaymentPanel'
import { useCambiarEstadoPresupuesto } from './api'
import type { Presupuesto } from './types'

/** Cobrar un presupuesto aprobado: arma el carrito solo con sus ítems (nada
 * de re-tipear productos) y abre el mismo cobro del POS. La venta que sale
 * de acá es una venta real — entra a caja, descuenta stock y aparece en las
 * estadísticas con su medio de pago, exactamente como una del mostrador. */
export function PresupuestoCobrarModal({ presupuesto, onClose, onCobrado }: {
  presupuesto: Presupuesto
  onClose: () => void
  onCobrado: () => void
}) {
  const { toast } = useToast()
  const { data: clienteVinculado } = useClientePorId(presupuesto.cliente)
  const cambiarEstado = useCambiarEstadoPresupuesto()
  const [cobrando, setCobrando] = useState(false)

  const itemsValidos = presupuesto.items.filter((i) => i.producto !== null)
  const subtotal = itemsValidos.reduce((acc, i) => acc + Number(i.subtotal), 0)

  async function handleCobrar(datos: DatosCobro) {
    setCobrando(true)
    try {
      const total = Math.max(subtotal - Number(datos.descuento || 0) + Number(datos.recargoMonto || 0), 0)
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
        origen: 'presupuesto',
      })

      if (resultado.status !== 'ok') {
        // Sin red la venta queda igual encolada y se va a sincronizar sola
        // (ver useOfflineSync), pero acá no hay id todavía para linkear el
        // presupuesto: hay que reintentar "Cobrar" con conexión.
        toast('Sin conexión: la venta se guardó para sincronizar, pero el presupuesto no quedó marcado como cobrado. Reintentá cuando vuelva internet.', 'error')
        return
      }

      await cambiarEstado.mutateAsync({ id: presupuesto.id, estado: 'cobrado', venta: resultado.venta.id })
      toast(`Presupuesto cobrado — ticket #${resultado.venta.numero_ticket}`)
      onCobrado()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cobrar el presupuesto'), 'error')
    } finally {
      setCobrando(false)
    }
  }

  return (
    <Modal title={`Cobrar presupuesto de ${presupuesto.cliente_nombre}`} onClose={onClose} wide>
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs text-text-dim">
            Los precios se cobran a los vigentes hoy, no a los del día del presupuesto.
          </p>
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            {itemsValidos.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-start gap-1.5 text-text-dim">
                  <Package size={13} className="mt-0.5 shrink-0" />
                  <span className="truncate">
                    {Number(item.cantidad)}
                    {item.es_bolsa ? ` bolsa${Number(item.cantidad) === 1 ? '' : 's'}` : ` ${item.unidad_medida ?? ''}`}
                    {' · '}{item.producto_nombre ?? 'Producto'}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-text">{formatMoney(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>

        <PaymentPanel
          subtotal={subtotal}
          cobrando={cobrando}
          disabled={itemsValidos.length === 0}
          onCobrar={handleCobrar}
          clienteInicial={clienteVinculado}
        />
      </div>
    </Modal>
  )
}
