export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Sucursal {
  id: string
  nombre: string
  direccion: string
  telefono: string
  email: string
  rubro: string
  bloqueado: boolean
  bloqueado_motivo: string
  ventas_hoy: string
  caja_abierta: boolean
  alertas_count: number
}

export interface SucursalInput {
  nombre: string
  direccion?: string
  telefono?: string
  email?: string
  rubro?: string
}

export interface SucursalBloqueoInput {
  bloqueado: boolean
  bloqueado_motivo?: string
}

export interface ErrorLogEntry {
  id: string
  user_nombre: string
  tipo: string
  mensaje: string
  modulo: string
  url: string
  created_at: string
}
