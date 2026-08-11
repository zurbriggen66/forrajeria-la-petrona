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

export interface Compra {
  id: string
  proveedor: string | null
  proveedor_nombre: string | null
  numero_factura: string
  fecha: string
  total: string
  pagado: boolean
  caja_sesion: string | null
  items: CompraItem[]
  created_at: string
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
  pagado: boolean
  items: CompraItemInput[]
}

export interface CompraFiltros {
  proveedor?: string
  fecha_desde?: string
  fecha_hasta?: string
  pagado?: boolean
}
