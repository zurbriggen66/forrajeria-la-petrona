export interface VentaItemInput {
  producto: string
  cantidad: string
  es_bolsa?: boolean
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
  descuento?: string
  recargo_monto?: string
  origen?: string
}

export interface VentaItemResult {
  id: string
  producto: string
  producto_nombre: string | null
  combo: string | null
  cantidad: string
  peso_kg: string | null
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

export interface CartItem {
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
    precio_bolsa: string | null
    bolsa_kg: string | null
  }
  cantidad: string
  esBolsa: boolean
}
