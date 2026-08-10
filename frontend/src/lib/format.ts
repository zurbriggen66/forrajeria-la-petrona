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
