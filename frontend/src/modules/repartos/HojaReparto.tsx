import { Imprimible } from '../../components/ui/Imprimible'
import { Membrete } from '../../components/print/Membrete'
import { formatMoney } from '../../lib/format'
import { presentacionDe } from '../productos/presentacion'
import type { Reparto, RepartoItem } from './types'

function formatFechaSola(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

/** Qué tiene que cargar el repartidor, en bultos reales.
 *
 * "2" no le sirve a nadie parado frente al depósito: necesita saber si son 2
 * bolsas cerradas o 2 kg sueltos. */
function bultos(item: RepartoItem) {
  const cantidad = Number(item.cantidad)
  const unidad = item.unidad_medida || 'unidad'
  if (item.es_bolsa) {
    const pres = presentacionDe(unidad)
    const nombre = cantidad === 1 ? pres.envase : pres.envasePlural
    const contenido = Number(item.bolsa_kg) || 0
    return `${cantidad} ${nombre}${contenido ? ` de ${contenido}${unidad === 'unidad' ? 'u' : unidad}` : ''}`
  }
  return `${cantidad} ${unidad === 'unidad' ? (cantidad === 1 ? 'unidad' : 'unidades') : unidad}`
}

/** Un reparto en la hoja: a dónde va, qué lleva y cuánto cobra.
 *
 * El destino va en grande a propósito — es el dato que el repartidor mira en
 * la calle, muchas veces desde el asiento y con poca luz. */
function BloqueReparto({ reparto }: { reparto: Reparto }) {
  const aCobrar = Number(reparto.total)

  return (
    <section className="no-cortar" style={{ marginBottom: '6mm' }}>
      <div className="hoja-bloque">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10mm' }}>
          <div style={{ flex: 1 }}>
            <p className="hoja-etiqueta">Entregar a</p>
            <p className="hoja-valor">{reparto.cliente_nombre}</p>
            <p className="hoja-etiqueta" style={{ marginTop: '2mm' }}>Dirección</p>
            <p className="hoja-valor-grande">{reparto.destino}</p>
            {reparto.telefono && (
              <p className="hoja-valor" style={{ marginTop: '1mm' }}>Tel. {reparto.telefono}</p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            {/* En cuenta corriente el repartidor NO cobra: si el papel dice "A
                cobrar $21.700" igual que en los demás, cobra de más y el cliente
                termina pagando dos veces la misma mercadería. */}
            <p className="hoja-etiqueta">{reparto.a_cuenta_corriente ? 'No cobrar' : 'A cobrar'}</p>
            <p className="hoja-valor-grande">{formatMoney(aCobrar)}</p>
            {reparto.a_cuenta_corriente ? (
              <p className="hoja-valor" style={{ marginTop: '1mm' }}>VA A CUENTA CORRIENTE</p>
            ) : reparto.cuenta_pago_nombre && (
              <p className="hoja-valor" style={{ marginTop: '1mm' }}>{reparto.cuenta_pago_nombre}</p>
            )}
            {reparto.repartidor_nombre && (
              <p className="hoja-datos" style={{ marginTop: '2mm' }}>{reparto.repartidor_nombre}</p>
            )}
          </div>
        </div>
      </div>

      <table className="hoja-tabla">
        <thead>
          <tr>
            <th style={{ width: '10mm' }}>✓</th>
            <th style={{ width: '38mm' }}>Cargar</th>
            <th>Producto</th>
            <th className="hoja-num" style={{ width: '30mm' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {reparto.items.map((item) => (
            <tr key={item.id}>
              <td><span className="hoja-check" /></td>
              <td><strong>{bultos(item)}</strong></td>
              <td>{item.producto_nombre ?? 'Producto'}</td>
              <td className="hoja-num">{formatMoney(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {Number(reparto.costo_envio) > 0 && (
        <p className="hoja-datos">Envío: {formatMoney(reparto.costo_envio)}</p>
      )}

      {reparto.notas && (
        <div className="hoja-bloque">
          <p className="hoja-etiqueta">Notas</p>
          <p>{reparto.notas}</p>
        </div>
      )}

      <div className="hoja-firma">
        <div>Firma de quien recibe</div>
        <div>Aclaración</div>
      </div>
    </section>
  )
}

/** Hoja de un solo reparto, para llevar en la mano. */
export function HojaReparto({ reparto }: { reparto: Reparto }) {
  return (
    <Imprimible>
      <Membrete titulo="HOJA DE REPARTO" fecha={formatFechaSola(reparto.fecha)} />
      <BloqueReparto reparto={reparto} />
      <p className="hoja-pie">Documento no válido como factura. Comprobante de entrega.</p>
    </Imprimible>
  )
}

/** Hoja de ruta del día: todos los repartos de una fecha en un solo papel.
 *
 * Un repartidor con ocho entregas no quiere ocho hojas sueltas; quiere una
 * que le diga por dónde arrancar. Cada reparto arranca en página propia para
 * que ninguno quede partido al medio. */
export function HojaRutaDelDia({ repartos, fecha }: { repartos: Reparto[]; fecha: string }) {
  const aCobrar = repartos.reduce((acc, r) => acc + Number(r.total), 0)

  return (
    <Imprimible>
      <Membrete titulo="HOJA DE RUTA" fecha={formatFechaSola(fecha)} />

      <div className="hoja-bloque no-cortar">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p className="hoja-etiqueta">Entregas</p>
            <p className="hoja-valor-grande">{repartos.length}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="hoja-etiqueta">Total a cobrar en la vuelta</p>
            <p className="hoja-valor-grande">{formatMoney(aCobrar)}</p>
          </div>
        </div>
      </div>

      {/* Índice: qué hay por delante, de un vistazo, antes de salir. */}
      <table className="hoja-tabla no-cortar">
        <thead>
          <tr>
            <th style={{ width: '10mm' }}>#</th>
            <th>Cliente</th>
            <th>Dirección</th>
            <th className="hoja-num" style={{ width: '30mm' }}>A cobrar</th>
          </tr>
        </thead>
        <tbody>
          {repartos.map((r, i) => (
            <tr key={r.id}>
              <td className="hoja-num">{i + 1}</td>
              <td>{r.cliente_nombre}</td>
              <td>{r.destino}</td>
              <td className="hoja-num">{formatMoney(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {repartos.map((r, i) => (
        <div key={r.id} className="hoja-corte">
          <p className="hoja-etiqueta" style={{ marginTop: '6mm' }}>Entrega {i + 1} de {repartos.length}</p>
          <BloqueReparto reparto={r} />
        </div>
      ))}

      <p className="hoja-pie">Documento no válido como factura. Comprobante de entrega.</p>
    </Imprimible>
  )
}
