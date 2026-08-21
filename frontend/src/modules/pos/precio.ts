import type { Producto } from '../productos/types'
import type { CartItem } from './types'

type ProductoPrecio = Pick<Producto, 'precio_venta' | 'precio_oferta' | 'oferta_activa' | 'precio_bolsa'>

/** Precio de un producto según cómo se lo vende: la bolsa cerrada entera, o
 * suelto (con la oferta vigente si la tiene). Refleja lo que hace el backend
 * en productos/precios.py::resolver_precio_item — el server siempre recalcula,
 * esto es para mostrar el mismo número antes de confirmar. */
export function precioProducto(p: ProductoPrecio, esBolsa: boolean): number {
  if (esBolsa) return Number(p.precio_bolsa)
  return p.oferta_activa && p.precio_oferta ? Number(p.precio_oferta) : Number(p.precio_venta)
}

/** Precio unitario de una línea del carrito. Lo necesitan PosPage (subtotal),
 * Cart (fila y aviso de stock) y TicketModal (ticket de una venta offline). */
export function precioUnitario(item: CartItem): number {
  return precioProducto(item.producto, item.esBolsa)
}

/** Kg reales que representa la línea contra el stock del producto (que
 * siempre está en kg para productos de venta a granel) — 1 bolsa son
 * `bolsa_kg` kilos, no "1". Para productos que no son a granel, no aplica. */
export function kgEquivalente(item: CartItem): number {
  if (item.esBolsa) return Number(item.cantidad) * Number(item.producto.bolsa_kg)
  return Number(item.cantidad)
}

/** Un producto se puede vender también por bolsa cerrada cuando tiene los
 * tres datos cargados: es a granel, y tiene peso y precio de bolsa. */
export function tieneBolsa(p: Pick<Producto, 'venta_por_peso' | 'bolsa_kg' | 'precio_bolsa'>): boolean {
  return Boolean(p.venta_por_peso && p.bolsa_kg && p.precio_bolsa)
}

/** Id estable del input de peso de una línea del carrito, para poder
 * enfocarlo por DOM apenas se agrega un producto a granel. */
export function cantidadInputId(productoId: string, esBolsa: boolean): string {
  return `cart-cantidad-${productoId}-${esBolsa}`
}
