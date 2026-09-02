import { formatMoney, redondearCantidad } from '../../lib/format'
import type { VerificacionVenta } from './api'
import { resumenVerificacion } from './verificacion'

/** El aviso que se muestra después de anular o corregir una venta.
 *
 * Aparte de verificacion.ts sólo para que ese archivo no importe nada en
 * tiempo de ejecución y su chequeo pueda correr en Node pelado. Acá vive el
 * formato, que es lo único que no hace falta probar.
 *
 * Misma redacción en las dos operaciones a propósito: es un cartel que el
 * dueño aprende a leer de un vistazo.
 */
export function mensajeVerificacion(
  verificacion: VerificacionVenta | undefined,
): { mensaje: string; alerta: boolean } {
  const resumen = resumenVerificacion(verificacion)
  const partes: string[] = []

  if (resumen.saldo !== null) partes.push(`saldo del cliente ${formatMoney(resumen.saldo)}`)

  if (resumen.stock.length > 0) {
    // Signo explícito: "+3" es lo que volvió al stock al anular, "−1" lo que
    // se descontó de más al agregar un producto olvidado.
    partes.push(
      resumen.stock
        .map((f) => `${f.delta > 0 ? '+' : '−'}${redondearCantidad(Math.abs(f.delta))} ${f.nombre}`)
        .join(', '),
    )
  }

  if (resumen.alerta && resumen.diferencia !== null) {
    partes.push(
      `⚠ la cuenta de este cliente no cuadra: el saldo guardado difiere en ` +
      `${formatMoney(resumen.diferencia)} de la suma de sus movimientos`,
    )
  }

  return { mensaje: partes.join(' · '), alerta: resumen.alerta }
}
