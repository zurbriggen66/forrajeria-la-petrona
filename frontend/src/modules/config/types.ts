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
  permitir_venta_sin_stock: boolean
  /** Color de marca, "#rrggbb". Vacío = el azul del tema. */
  color_acento: string
}

export type ComercioConfigInput = Partial<Omit<ComercioConfig, 'id'>>

export const ROLES = ['Dueño', 'Administrador', 'Cajero', 'Repositor'] as const

export interface UsuarioComercio {
  id: string
  email: string
  nombre_completo: string
  rol: string
  /** Módulos que el Dueño le apagó (claves = rutas del menú). Vacío = ve todo.
   * Opcional: un backend anterior a esta versión no manda el campo. */
  modulos_bloqueados?: string[]
  created_at: string
}

export interface InvitarUsuarioInput {
  email: string
  nombre_completo?: string
  rol: string
  password?: string
}
