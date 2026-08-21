export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type EstadoPresupuesto = 'pendiente' | 'aprobado' | 'rechazado' | 'vencido'

export const ESTADOS: { value: EstadoPresupuesto; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'rechazado', label: 'Rechazado' },
  { value: 'vencido', label: 'Vencido' },
]

export interface PresupuestoItem {
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

export interface Presupuesto {
  id: string
  cliente: string | null
  cliente_registrado_nombre: string | null
  cliente_nombre: string
  numero: string
  notas: string
  estado: EstadoPresupuesto
  validez: string | null
  subtotal: string
  descuento: string
  total: string
  items: PresupuestoItem[]
  created_at: string
}

export interface PresupuestoItemInput {
  producto: string
  cantidad: string
  es_bolsa: boolean
}

export interface PresupuestoInput {
  cliente?: string | null
  cliente_nombre: string
  numero?: string
  notas?: string
  estado?: EstadoPresupuesto
  validez?: string | null
  descuento: string
  items: PresupuestoItemInput[]
}

export interface PresupuestoFiltros {
  estado?: EstadoPresupuesto
  search?: string
}
