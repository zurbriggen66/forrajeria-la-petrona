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
