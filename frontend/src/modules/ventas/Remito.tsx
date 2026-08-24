import { Imprimible } from '../../components/ui/Imprimible'
import { Membrete } from '../../components/print/Membrete'
import { formatMoney } from '../../lib/format'

/** Lo mínimo que hace falta para emitir el remito.
 *
 * Estructural y no `Venta` a secas para que sirva igual con el resultado que
 * devuelve el POS al cobrar (VentaResult), que trae los mismos campos pero no
 * el vendedor ni el motivo de anulación. */
export interface VentaImprimible {
  numero_ticket: number | null
  created_at: string
  cliente_nombre: string | null
  total: string
  descuento: string
  recargo_monto: string
  monto_cuenta_corriente: string
  anulada: boolean
  vendedor_nombre?: string | null
  motivo_anulacion?: string
  items: {
    id: string
    producto_nombre: string | null
    cantidad: string
    peso_kg: string | null
    precio_unitario: string
    subtotal: string
  }[]
  pagos: { id: string; cuenta_pago_nombre: string | null; monto: string }[]
}

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Cantidad tal como se vendió. `peso_kg` guarda los kg/metros reales cuando
 * se vendió una presentación cerrada, así que ahí se muestran las dos cosas:
 * el cliente tiene que poder verificar que le cobraron lo que se llevó. */
function cantidadItem(item: VentaImprimible['items'][number]) {
  const cantidad = Number(item.cantidad)
  const reales = item.peso_kg === null ? null : Number(item.peso_kg)
  if (reales !== null && reales !== cantidad) {
    return `${cantidad} (${reales})`
  }
  return String(cantidad)
}

/** Remito de una venta, para entregarle al cliente.
 *
 * No es un comprobante fiscal: la factura electrónica sale por ARCA (módulo
 * fiscal) y tiene su propio CAE. Este papel documenta la entrega de la
 * mercadería, y lo dice explícitamente para que nadie lo confunda.
 */
export function Remito({ venta }: { venta: VentaImprimible }) {
  const subtotal = venta.items.reduce((acc, i) => acc + Number(i.subtotal), 0)
  const descuento = Number(venta.descuento)
  const recargo = Number(venta.recargo_monto)
  const fiado = Number(venta.monto_cuenta_corriente)

  return (
    <Imprimible>
      <Membrete
        titulo="REMITO"
        numero={venta.numero_ticket ? String(venta.numero_ticket) : undefined}
        fecha={formatFechaHora(venta.created_at)}
      />

      {venta.anulada && <p className="hoja-aviso">VENTA ANULADA — {venta.motivo_anulacion}</p>}

      <div className="hoja-bloque no-cortar">
        <p className="hoja-etiqueta">Cliente</p>
        <p className="hoja-valor">{venta.cliente_nombre ?? 'Consumidor final'}</p>
        {venta.vendedor_nombre && (
          <p className="hoja-datos">Atendido por {venta.vendedor_nombre}</p>
        )}
      </div>

      <table className="hoja-tabla">
        <thead>
          <tr>
            <th style={{ width: '18mm' }}>Cant.</th>
            <th>Descripción</th>
            <th className="hoja-num" style={{ width: '28mm' }}>P. unitario</th>
            <th className="hoja-num" style={{ width: '30mm' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venta.items.map((item) => (
            <tr key={item.id}>
              <td className="hoja-num">{cantidadItem(item)}</td>
              <td>{item.producto_nombre ?? 'Producto'}</td>
              <td className="hoja-num">{formatMoney(item.precio_unitario)}</td>
              <td className="hoja-num">{formatMoney(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="hoja-totales no-cortar">
        <div><span>Subtotal</span><span className="hoja-num">{formatMoney(subtotal)}</span></div>
        {descuento > 0 && (
          <div><span>Descuento</span><span className="hoja-num">− {formatMoney(descuento)}</span></div>
        )}
        {recargo > 0 && (
          <div><span>Recargo</span><span className="hoja-num">+ {formatMoney(recargo)}</span></div>
        )}
        <div className="hoja-total-final"><span>TOTAL</span><span className="hoja-num">{formatMoney(venta.total)}</span></div>
      </div>

      {/* Lo que quedó fiado es lo que el cliente tiene que ver más grande: es
          plata que todavía debe, no una compra saldada. */}
      {fiado > 0 && (
        <div className="hoja-bloque no-cortar" style={{ marginTop: '4mm' }}>
          <p className="hoja-etiqueta">Queda en cuenta corriente</p>
          <p className="hoja-valor-grande">{formatMoney(fiado)}</p>
        </div>
      )}

      {venta.pagos.length > 0 && (
        <p className="hoja-datos" style={{ marginTop: '3mm' }}>
          Pagado con: {venta.pagos.map((p) => `${p.cuenta_pago_nombre ?? 'Efectivo'} ${formatMoney(p.monto)}`).join(' · ')}
        </p>
      )}

      <div className="hoja-firma">
        <div>Firma y aclaración de quien recibe</div>
        <div>Aclaración / DNI</div>
      </div>

      <p className="hoja-pie">
        Documento no válido como factura. Comprobante de entrega de mercadería.
      </p>
    </Imprimible>
  )
}
