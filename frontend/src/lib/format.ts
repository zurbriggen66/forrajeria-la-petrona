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
