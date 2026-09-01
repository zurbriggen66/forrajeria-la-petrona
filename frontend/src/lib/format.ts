const ARS = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  return `$ ${ARS.format(Number.isFinite(n) ? n : 0)}`
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1)}%`
}

/** Contraparte de formatMoney: pasa a número lo que tipeó el usuario.
 *
 * Acá se escribe "2,5", no "2.5". Un <input type="number"> con coma queda en
 * estado inválido y devuelve '' — el renglón se iba a $ 0,00 con el "2,5"
 * todavía a la vista. Por eso los campos de plata y cantidad son de texto con
 * inputMode="decimal" (ver InputDecimal) y pasan por acá.
 *
 * Devuelve NaN sólo si hay algo que no es un número; el vacío da 0 para que
 * un campo a medio tipear no rompa un total. */
export function parseDecimal(texto: string | number | null | undefined): number {
  if (typeof texto === 'number') return texto
  if (texto === null || texto === undefined) return 0
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return 0
  return Number(limpio)
}

/** Formatea una fecha "sola" (YYYY-MM-DD, sin hora) tal como viene de un
 * DateField del backend — ej. Gasto.fecha, los bordes de un período de
 * estadísticas. `new Date('YYYY-MM-DD')` la interpreta como medianoche UTC;
 * en un huso negativo como Buenos Aires (UTC-3, sin DST) eso muestra
 * siempre el día anterior. Construir la fecha con año/mes/día locales evita
 * el problema por completo. */
export function formatFechaSola(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-AR')
}

/** Cuántos decimales admite una cantidad: los mismos que la columna del
 * backend (VentaItem.cantidad y RepartoItem.cantidad son decimal_places=3). */
const DECIMALES_CANTIDAD = 3

/** Una cantidad lista para mandar al servidor.
 *
 * Existe porque sumar cantidades en JavaScript ensucia el número: el POS suma
 * 0,1 kg cada vez que se toca un producto a granel, y `1.1 + 0.1` da
 * `1.2000000000000002`. Eso son dieciséis decimales, el backend acepta tres, y
 * la venta se rechazaba entera con "Asegúrese de que no haya más de 3
 * decimales" — un error que el cajero no tenía forma de entender ni de
 * arreglar, porque el número que veía en pantalla era "1,2".
 *
 * Devuelve string y no number a propósito: es lo que viaja en el payload, y
 * pasar por Number otra vez volvería a abrir la puerta al mismo problema. */
export function redondearCantidad(valor: number): string {
  if (!Number.isFinite(valor)) return '0'
  // toFixed y después Number para sacar los ceros de cola ("1.200" -> "1.2"),
  // que no molestan pero ensucian el campo mientras se tipea.
  return String(Number(valor.toFixed(DECIMALES_CANTIDAD)))
}

/** Un monto listo para mandar al servidor: dos decimales, que es lo que
 * aceptan las columnas de plata.
 *
 * Convierte también el vacío en '0'. Suena obvio, pero era la causa de que una
 * venta entera se rechazara con "Se requiere un número válido": el cajero
 * borraba el 0 del campo Descuento para escribir otro y, si cobraba sin
 * completarlo, viajaba una cadena vacía. */
export function redondearMonto(valor: string | number | null | undefined): string {
  const n = parseDecimal(valor ?? '')
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}
