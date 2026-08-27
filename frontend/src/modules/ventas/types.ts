export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface VentaItem {
  id: string
  producto: string | null
  producto_nombre: string | null
  combo: string | null
  cantidad: string
  peso_kg: string | null
  // Precio ACTUAL del producto (no el precio_unitario congelado en esta
  // línea), para poder reabrir la venta en el editor de ítems. Ver
  // VentaItemSerializer en el backend.
  unidad_medida: string | null
  bolsa_kg: string | null
  venta_por_peso: boolean
  precio_venta: string | null
  precio_bolsa: string | null
  precio_oferta: string | null
  oferta_activa: boolean
  descuento_pct: string
  precio_unitario: string
  costo_unitario: string
  subtotal: string
}

export interface VentaPago {
  id: string
  cuenta_pago: string | null
  cuenta_pago_nombre: string | null
  monto: string
}

export interface Venta {
  id: string
  numero_ticket: number | null
  sync_uuid: string
  vendedor: string | null
  vendedor_nombre: string | null
  cliente: string | null
  cliente_nombre: string | null
  cuenta_pago: string | null
  cuenta_pago_nombre: string | null
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
  motivo_anulacion: string
  fecha_anulacion: string | null
  facturado: boolean
  created_at: string
  items: VentaItem[]
  pagos: VentaPago[]
}

export interface VentasFiltros {
  fecha_desde?: string
  fecha_hasta?: string
  vendedor?: string
  cuenta_pago?: string
  categoria?: string
  proveedor?: string
  cliente?: string
  anulada?: boolean
  numero_ticket?: string
  page?: number
}

export interface Vendedor {
  id: string
  nombre_completo: string
  rol: string
}
