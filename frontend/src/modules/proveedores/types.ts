export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Proveedor {
  id: string
  nombre: string
  cuit: string
  contacto: string
  telefono: string
  email: string
  direccion: string
  categoria: string
  condicion_pago: string
  notas: string
  saldo_actual: string
  activo: boolean
}

export interface ProveedorInput {
  nombre: string
  cuit: string
  contacto: string
  telefono: string
  email: string
  direccion: string
  categoria: string
  condicion_pago: string
  notas: string
  activo: boolean
}

export type TipoMovimientoProveedor = 'compra' | 'pago' | 'ajuste'

export interface ProveedorMovimiento {
  id: string
  proveedor: string
  tipo: TipoMovimientoProveedor
  monto: string
  referencia: string
  created_at: string
}

export interface MovimientoProveedorInput {
  tipo: 'pago' | 'ajuste'
  monto: string
  referencia?: string
}

export interface PedidoSugerido {
  producto: string
  nombre: string
  proveedor: string | null
  proveedor_nombre: string | null
  stock: string
  stock_minimo: string
  cantidad_sugerida: string
}

export interface PedidoManualItem {
  producto: string
  nombre: string
  cantidad: string
  proveedor: string | null
  proveedor_nombre: string | null
}

export interface PedidoManual {
  id: string
  detalle: PedidoManualItem[] | null
  estado: string
  created_at: string
  updated_at: string
}
