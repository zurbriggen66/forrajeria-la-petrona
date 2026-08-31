import { parseDecimal } from '../../lib/format'
import type { Producto } from '../productos/types'
import type { CartItem, CartItemProducto } from './types'

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
 * Cart (fila y aviso de stock) y TicketModal (ticket de una venta offline).
 *
 * Un pack vale lo suyo y no la suma de sus productos: ése es todo el sentido
 * de armarlo. El servidor usa el mismo precio (ventas/views.py::_crear_venta). */
export function precioUnitario(item: CartItem): number {
  if (item.tipo === 'pack') return Number(item.pack.precio)
  return precioProducto(item.producto, item.esBolsa)
}

/** Lo que se cobra por una línea del carrito, ya con el descuento pactado
 * sobre ese producto. Espeja el cálculo del backend en
 * ventas/views.py::_crear_venta — el server siempre recalcula, esto es para
 * mostrar el mismo número antes de cobrar. */
export function subtotalLinea(item: CartItem): number {
  const pct = Math.min(Math.max(parseDecimal(item.descuentoPct), 0), 100)
  return precioUnitario(item) * parseDecimal(item.cantidad) * (1 - pct / 100)
}

/** Kg reales que representa la línea contra el stock del producto (que
 * siempre está en kg para productos de venta a granel) — 1 bolsa son
 * `bolsa_kg` kilos, no "1". Para productos que no son a granel, no aplica. */
export function kgEquivalente(item: CartItemProducto): number {
  if (item.esBolsa) return parseDecimal(item.cantidad) * Number(item.producto.bolsa_kg)
  return parseDecimal(item.cantidad)
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

/** Identidad de una línea del carrito: dos líneas con la misma clave son la
 * misma cosa y se suman en vez de duplicarse. Un producto se distingue por
 * su presentación (suelto o envase cerrado son dos líneas distintas); un pack,
 * sólo por su id.
 *
 * Está acá y no repetida en cada componente porque la usan el carrito (rowKey),
 * PosPage (para sumar al agregar) y el ticket. */
export function claveLinea(item: CartItem): string {
  return item.tipo === 'pack' ? `pack:${item.pack.id}` : `${item.producto.id}:${item.esBolsa}`
}
