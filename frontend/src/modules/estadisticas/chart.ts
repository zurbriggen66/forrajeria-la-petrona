import { formatMoney } from '../../lib/format'

/** Estilos compartidos del tooltip de recharts, para no repetirlos por gráfico. */
export const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    color: 'var(--color-text)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--color-text-dim)' },
  cursor: { fill: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' },
} as const

export const EJE_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--color-text-dim)', fontSize: 11 },
} as const

/** Los montos en pesos argentinos son largos; en los ejes se abrevian para que
 * no se coman el ancho del gráfico. */
export function montoCorto(valor: number) {
  if (Math.abs(valor) >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1)}M`
  if (Math.abs(valor) >= 1_000) return `$${Math.round(valor / 1_000)}k`
  return formatMoney(valor).replace(',00', '')
}
