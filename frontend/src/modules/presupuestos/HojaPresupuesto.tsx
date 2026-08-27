import { Imprimible } from '../../components/ui/Imprimible'
import { Membrete } from '../../components/print/Membrete'
import { formatFechaSola, formatMoney } from '../../lib/format'
import type { Presupuesto } from './types'

/** Cantidad tal como se cotizó: bolsas cerradas o unidades sueltas. */
function cantidadItem(item: Presupuesto['items'][number]) {
  const cantidad = Number(item.cantidad)
  if (item.es_bolsa) {
    const kg = item.bolsa_kg ? ` de ${Number(item.bolsa_kg)}kg` : ''
    return `${cantidad} bolsa${cantidad === 1 ? '' : 's'}${kg}`
  }
  return `${cantidad} ${item.unidad_medida ?? ''}`.trim()
}

/** Presupuesto para entregarle al cliente.
 *
 * No es remito ni factura: no se entregó nada todavía. Lo que importa en el
 * papel es hasta cuándo vale el precio, porque es lo primero que se discute
 * cuando el cliente vuelve dos semanas después. */
export function HojaPresupuesto({ presupuesto }: { presupuesto: Presupuesto }) {
  const descuento = Number(presupuesto.descuento)

  return (
    <Imprimible>
      <Membrete
        titulo="PRESUPUESTO"
        numero={presupuesto.numero || undefined}
        fecha={new Date(presupuesto.created_at).toLocaleDateString('es-AR')}
      />

      <div className="hoja-bloque no-cortar">
        <p className="hoja-etiqueta">Cliente</p>
        <p className="hoja-valor">{presupuesto.cliente_nombre}</p>
      </div>

      <table className="hoja-tabla">
        <thead>
          <tr>
            <th style={{ width: '30mm' }}>Cant.</th>
            <th>Descripción</th>
            <th className="hoja-num" style={{ width: '28mm' }}>P. unitario</th>
            <th className="hoja-num" style={{ width: '30mm' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {presupuesto.items.map((item) => (
            <tr key={item.id}>
              <td>{cantidadItem(item)}</td>
              <td>{item.producto_nombre ?? 'Producto'}</td>
              <td className="hoja-num">{formatMoney(item.precio_unitario)}</td>
              <td className="hoja-num">{formatMoney(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="hoja-totales no-cortar">
        <div><span>Subtotal</span><span className="hoja-num">{formatMoney(presupuesto.subtotal)}</span></div>
        {descuento > 0 && (
          <div><span>Descuento</span><span className="hoja-num">− {formatMoney(descuento)}</span></div>
        )}
        <div className="hoja-total-final"><span>TOTAL</span><span className="hoja-num">{formatMoney(presupuesto.total)}</span></div>
      </div>

      {/* La validez va destacada y no en letra chica: es la condición que
          protege al comercio cuando los precios se mueven. */}
      {presupuesto.validez && (
        <p className="hoja-aviso" style={{ marginTop: '4mm' }}>
          Precios válidos hasta el {formatFechaSola(presupuesto.validez)}
        </p>
      )}

      {presupuesto.notas && (
        <div className="hoja-bloque no-cortar">
          <p className="hoja-etiqueta">Observaciones</p>
          <p>{presupuesto.notas}</p>
        </div>
      )}

      <p className="hoja-pie">
        Presupuesto sin validez como factura. No incluye la entrega de mercadería
        ni reserva stock hasta su aprobación.
      </p>
    </Imprimible>
  )
}
