export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type TipoGasto = 'fijo' | 'variable'

export interface Gasto {
  id: string
  caja_sesion: string | null
  cuenta: string | null
  cuenta_nombre: string | null
  tipo: TipoGasto
  categoria: string
  descripcion: string
  monto: string
  fecha: string
  created_at: string
}

export interface GastoInput {
  tipo: TipoGasto
  categoria: string
  descripcion: string
  monto: string
  fecha: string
  cuenta_id?: string | null
}

export interface GastosResumen {
  total: string
  por_categoria: { categoria: string; monto: string }[]
}
