export interface VentaItemInput {
  /** Uno de los dos, nunca los dos: una línea es un producto o un pack. */
  producto?: string
  combo?: string
  cantidad: string
  es_bolsa?: boolean
  /** Descuento sobre este producto (0–100). El de la venta entera va aparte. */
  descuento_pct?: string
}

export interface VentaPagoInput {
  cuenta_pago: string | null
  monto: string
}

export interface VentaInput {
  sync_uuid: string
  items: VentaItemInput[]
  cliente?: string | null
  cuenta_pago?: string | null
  /** Desglose del cobro mixto. Ausente = cobro con un solo medio. */
  pagos?: VentaPagoInput[]
  metodo_pago?: string
  monto_efectivo?: string
  monto_tarjeta?: string
  monto_transferencia?: string
  monto_cuenta_corriente?: string
  efectivo_recibido?: string | null
  /** Cuenta desde la que se da el vuelto, si es distinta de la que cobra. */
  vuelto_cuenta_pago?: string | null
  descuento?: string
  recargo_monto?: string
  origen?: string
}

export interface VentaItemResult {
  id: string
  producto: string
  producto_nombre: string | null
  combo: string | null
  /** Nombre del pack cuando la línea es un pack (producto_nombre viene null). */
  combo_nombre: string | null
  cantidad: string
  peso_kg: string | null
  descuento_pct: string
  precio_unitario: string
  costo_unitario: string
  subtotal: string
}

export interface VentaPagoResult {
  id: string
  cuenta_pago: string | null
  cuenta_pago_nombre: string | null
  monto: string
}

export interface VentaResult {
  id: string
  numero_ticket: number
  sync_uuid: string
  cliente: string | null
  cliente_nombre: string | null
  cuenta_pago: string | null
  total: string
  descuento: string
  recargo_monto: string
  metodo_pago: string
  monto_efectivo: string
  monto_tarjeta: string
  monto_transferencia: string
  monto_cuenta_corriente: string
  efectivo_recibido: string | null
  vuelto: string | null
  vuelto_cuenta_pago: string | null
  vuelto_cuenta_pago_nombre: string | null
  origen: string
  anulada: boolean
  created_at: string
  items: VentaItemResult[]
  pagos: VentaPagoResult[]
  facturado: boolean
  cae: string
  cae_vencimiento: string | null
  tipo_factura: string
  numero_factura: string
  punto_venta_factura: string
  qr_url: string | null
}

export interface CuentaPago {
  id: string
  nombre: string
  tipo: string
  comision_pct: string
  activo: boolean
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  tipo: string
  saldo_actual: string
  limite_credito: string
  kubobots_fid_off: boolean
}

interface LineaBase {
  cantidad: string
  /** Descuento sobre esta línea, en % (0–100). '' o '0' = sin descuento. */
  descuentoPct: string
}

/** Un producto suelto (o su envase cerrado, con `esBolsa`). */
export interface CartItemProducto extends LineaBase {
  tipo: 'producto'
  producto: {
    id: string
    nombre: string
    codigo_barras: string
    precio_venta: string
    precio_oferta: string | null
    oferta_activa: boolean
    venta_por_peso: boolean
    unidad_medida: string
    stock: string
    stock_en_bolsas: boolean
    precio_bolsa: string | null
    bolsa_kg: string | null
  }
  esBolsa: boolean
}

/** Un pack: se cobra a su propio precio como una sola línea, y el servidor
 * descuenta el stock de cada producto que lo compone. */
export interface CartItemPack extends LineaBase {
  tipo: 'pack'
  pack: {
    id: string
    nombre: string
    precio: string
    /** Cuántos entran en el stock de hoy, para avisar antes de cobrar. */
    armables: number
    /** "10× Balanceado + 12× Huevo", para la fila del carrito y el ticket. */
    detalle: string
  }
}

/** Una línea del carrito. Es una unión discriminada a propósito: un pack no
 * tiene producto, ni bolsa, ni stock propio, y dejarlos opcionales hacía que
 * cada lectura tuviera que adivinar. Con `tipo` el compilador marca todos los
 * lugares que faltan contemplar. */
export type CartItem = CartItemProducto | CartItemPack
