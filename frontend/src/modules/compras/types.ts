export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CompraItem {
  id: string
  producto: string
  producto_nombre: string | null
  cantidad: string
  costo_unitario: string
  subtotal: string
}

export type EstadoCompra = 'pendiente' | 'parcial' | 'pagada'

export interface CompraPago {
  id: string
  fecha: string
  monto: string
  cuenta: string | null
  cuenta_nombre: string | null
  notas: string
  created_at: string
}

export interface Compra {
  id: string
  proveedor: string | null
  proveedor_nombre: string | null
  numero_factura: string
  fecha: string
  /** Cuándo hay que pagarla. Null en las compras al contado. */
  fecha_vencimiento: string | null
  total: string
  pagado: boolean
  estado: EstadoCompra
  total_pagado: string
  saldo_pendiente: string
  caja_sesion: string | null
  items: CompraItem[]
  pagos: CompraPago[]
  created_at: string
}

export interface CompraPagoInput {
  fecha: string
  monto: string
  cuenta_pago?: string | null
  notas?: string
}

export interface CompraItemInput {
  producto: string
  cantidad: string
  costo_unitario: string
}

export interface CompraInput {
  proveedor?: string | null
  numero_factura?: string
  fecha: string
  fecha_vencimiento?: string | null
  pagado: boolean
  cuenta_pago?: string | null
  items: CompraItemInput[]
}

export interface CompraFiltros {
  proveedor?: string
  fecha_desde?: string
  fecha_hasta?: string
  pagado?: boolean
}
