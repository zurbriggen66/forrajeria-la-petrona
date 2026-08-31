import type { CartItem } from './types'

/** Ventas a medio cargar, guardadas en este dispositivo.
 *
 * Para el mostrador: entra alguien que lleva una sola cosa mientras el de
 * antes sigue eligiendo — se pausa la venta grande, se cobra la chica, y se
 * retoma. Nada de esto viaja al servidor: es una venta que todavía no existe.
 *
 * El carrito en curso también se guarda, así irse a mirar el stock (o que se
 * recargue la pestaña) no se lleva puesta la venta.
 *
 * ponytail: se guarda el Producto tal como estaba al agregarlo, así que si
 * alguien le cambia el precio mientras la venta está pausada, el total que se
 * ve queda viejo. No afecta lo que se cobra: el backend repreciá todo contra
 * el producto vigente al registrar la venta (resolver_precio_item).
 */
export interface VentaPausada {
  id: string
  /** Cómo la reconoce el cajero: el primer producto y cuántos más. */
  nombre: string
  items: CartItem[]
  pausada_en: string
}

const CLAVE_PAUSADAS = 'pos-ventas-pausadas'
const CLAVE_CARRITO = 'pos-carrito-en-curso'

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? (JSON.parse(raw) as T) : porDefecto
  } catch {
    // JSON corrupto o localStorage no disponible: se arranca vacío, no se
    // rompe el POS por una venta a medio cargar.
    return porDefecto
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // localStorage lleno: perder el respaldo no puede frenar el mostrador.
  }
}

export function leerCarrito(): CartItem[] {
  return leer<CartItem[]>(CLAVE_CARRITO, [])
}

export function guardarCarrito(items: CartItem[]) {
  escribir(CLAVE_CARRITO, items)
}

export function listarPausadas(): VentaPausada[] {
  return leer<VentaPausada[]>(CLAVE_PAUSADAS, [])
}

function nombrarVenta(items: CartItem[]) {
  const primera = items[0]
  const primero = !primera
    ? 'Venta'
    : primera.tipo === 'pack' ? primera.pack.nombre : primera.producto.nombre
  return items.length > 1 ? `${primero} +${items.length - 1}` : primero
}

export function pausarVenta(items: CartItem[]): VentaPausada[] {
  const venta: VentaPausada = {
    id: crypto.randomUUID(),
    nombre: nombrarVenta(items),
    items,
    pausada_en: new Date().toISOString(),
  }
  const pausadas = [venta, ...listarPausadas()]
  escribir(CLAVE_PAUSADAS, pausadas)
  return pausadas
}

export function quitarPausada(id: string): VentaPausada[] {
  const pausadas = listarPausadas().filter((v) => v.id !== id)
  escribir(CLAVE_PAUSADAS, pausadas)
  return pausadas
}
