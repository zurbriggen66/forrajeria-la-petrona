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
  precio_unitario: string
  costo_unitario: string
  subtotal: string
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
  origen: string
  anulada: boolean
  motivo_anulacion: string
  fecha_anulacion: string | null
  created_at: string
  items: VentaItem[]
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
}

export interface Vendedor {
  id: string
  nombre_completo: string
  rol: string
}
