export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type EstadoReparto = 'pendiente' | 'en_camino' | 'entregado' | 'cancelado'

export const ESTADOS: { value: EstadoReparto; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_camino', label: 'En camino' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export interface RepartoItem {
  id: string
  producto: string | null
  producto_nombre: string | null
  unidad_medida: string | null
  bolsa_kg: string | null
  cantidad: string
  es_bolsa: boolean
  precio_unitario: string
  subtotal: string
}

export interface Reparto {
  id: string
  cliente: string | null
  cliente_registrado_nombre: string | null
  cliente_nombre: string
  telefono: string
  destino: string
  fecha: string
  estado: EstadoReparto
  repartidor: string | null
  repartidor_nombre: string | null
  notas: string
  subtotal: string
  costo_envio: string
  descuento: string
  total: string
  items: RepartoItem[]
  created_at: string
}

export interface RepartoItemInput {
  producto: string
  cantidad: string
  es_bolsa: boolean
}

export interface RepartoInput {
  cliente?: string | null
  cliente_nombre: string
  telefono?: string
  destino: string
  fecha: string
  estado?: EstadoReparto
  notas?: string
  costo_envio: string
  descuento: string
  items: RepartoItemInput[]
}

export interface RepartoFiltros {
  estado?: EstadoReparto
  fecha_desde?: string
  fecha_hasta?: string
  search?: string
}
