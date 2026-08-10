export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Gasto {
  id: string
  caja_sesion: string | null
  cuenta: string | null
  cuenta_nombre: string | null
  categoria: string
  descripcion: string
  monto: string
  fecha: string
  created_at: string
}

export interface GastoInput {
  categoria: string
  descripcion: string
  monto: string
  fecha: string
  cuenta_id?: string | null
}
