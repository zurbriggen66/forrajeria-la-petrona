import { presentacionDe } from './presentacion'
import type { Producto } from './types'

function redondear2(n: number): number {
  return Math.round(n * 100) / 100
}

type ProductoStock = Pick<Producto, 'venta_por_peso' | 'unidad_medida' | 'stock_en_bolsas' | 'bolsa_kg'>

/** El stock de un producto siempre se guarda en kg (ver comentario en el
 * modelo Producto) — esto sólo lo muestra en la unidad que el dueño eligió
 * para pensarlo: kg, o cantidad de bolsas cuando el producto tiene bolsa y
 * así lo configuró. */
export function formatCantidadStock(valorKg: string | number, p: ProductoStock): string {
  const kg = Number(valorKg)
  if (p.venta_por_peso && p.stock_en_bolsas && Number(p.bolsa_kg) > 0) {
    const cantidad = redondear2(kg / Number(p.bolsa_kg))
    const pres = presentacionDe(p.unidad_medida)
    return `${cantidad} ${cantidad === 1 ? pres.envase : pres.envasePlural}`
  }
  if (p.venta_por_peso) return `${redondear2(kg)} ${p.unidad_medida}`
  return String(redondear2(kg))
}
