export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type EstadoPresupuesto = 'pendiente' | 'aprobado' | 'rechazado' | 'vencido' | 'cobrado'

export const ESTADOS: { value: EstadoPresupuesto; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'cobrado', label: 'Cobrado' },
  { value: 'rechazado', label: 'Rechazado' },
  { value: 'vencido', label: 'Vencido' },
]

export interface PresupuestoItem {
  id: string
  producto: string | null
  producto_nombre: string | null
  unidad_medida: string | null
  bolsa_kg: string | null
  // Precio ACTUAL del producto (no el congelado en precio_unitario/subtotal),
  // para poder reabrir el presupuesto en el editor de ítems. Ver
  // PresupuestoItemSerializer en el backend.
  venta_por_peso: boolean
  precio_venta: string | null
  precio_bolsa: string | null
  precio_oferta: string | null
  oferta_activa: boolean
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
  // Seteados al cobrar (ver PresupuestoCobrarModal) — la venta real que se
  // generó a partir de este presupuesto.
  venta: string | null
  venta_numero_ticket: number | null
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
  cliente?: string
}
