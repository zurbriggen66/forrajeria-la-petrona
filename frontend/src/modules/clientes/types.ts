export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  celular: string
  email: string
  cuit: string
  direccion: string
  tipo: string
  saldo_actual: string
  limite_credito: string
  kubobots_fid_off: boolean
  activo: boolean
}

export interface ClienteInput {
  nombre: string
  telefono: string
  celular: string
  email: string
  cuit: string
  direccion: string
  tipo: string
  limite_credito: string
  activo: boolean
}

export type TipoMovimientoCliente = 'cargo' | 'pago' | 'ajuste'
export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta'

export interface ClienteMovimiento {
  id: string
  cliente: string
  tipo: TipoMovimientoCliente
  monto: string
  referencia: string
  medio_pago: MedioPago | ''
  created_at: string
}

export interface ClienteMovimientoInput {
  tipo: 'pago' | 'ajuste'
  monto: string
  referencia?: string
  medio_pago?: MedioPago | ''
}

export interface ClienteAsignacion {
  id: string
  cliente: string
  vendedor: string | null
  vendedor_nombre: string | null
  activo: boolean
  created_at: string
}
