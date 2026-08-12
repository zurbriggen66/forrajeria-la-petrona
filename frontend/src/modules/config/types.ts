export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ComercioConfig {
  id: string
  nombre: string
  cuit: string
  direccion: string
  telefono: string
  email: string
  logo_url: string
  rubro: string
}

export type ComercioConfigInput = Partial<Omit<ComercioConfig, 'id'>>

export const ROLES = ['Dueño', 'Administrador', 'Cajero', 'Repositor'] as const

export interface UsuarioComercio {
  id: string
  email: string
  nombre_completo: string
  rol: string
  created_at: string
}

export interface InvitarUsuarioInput {
  email: string
  nombre_completo?: string
  rol: string
  password?: string
}
