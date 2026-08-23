/** Atajos de período para los filtros de fecha. Devuelven [desde, hasta] en
 * formato ISO local — se arman con getFullYear/getMonth y no con toISOString(),
 * que pasa a UTC y en Buenos Aires (UTC-3) corre un día. */

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sumarDias(d: Date, dias: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

export interface Periodo {
  label: string
  rango: () => [string, string]
}

export const PERIODOS: Periodo[] = [
  { label: 'Hoy', rango: () => { const h = new Date(); return [iso(h), iso(h)] } },
  {
    label: 'Ayer',
    rango: () => { const a = sumarDias(new Date(), -1); return [iso(a), iso(a)] },
  },
  {
    label: 'Últimos 7 días',
    rango: () => { const h = new Date(); return [iso(sumarDias(h, -6)), iso(h)] },
  },
  {
    label: 'Últimos 30 días',
    rango: () => { const h = new Date(); return [iso(sumarDias(h, -29)), iso(h)] },
  },
  {
    label: 'Este mes',
    rango: () => {
      const h = new Date()
      return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)]
    },
  },
  {
    label: 'Mes pasado',
    rango: () => {
      const h = new Date()
      const primero = new Date(h.getFullYear(), h.getMonth() - 1, 1)
      const ultimo = new Date(h.getFullYear(), h.getMonth(), 0)
      return [iso(primero), iso(ultimo)]
    },
  },
  {
    label: 'Este año',
    rango: () => {
      const h = new Date()
      return [iso(new Date(h.getFullYear(), 0, 1)), iso(h)]
    },
  },
]
