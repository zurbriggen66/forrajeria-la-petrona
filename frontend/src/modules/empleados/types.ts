export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Turno {
  id: string
  empleado: string | null
  empleado_nombre: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  notas: string
  created_at: string
}

export interface TurnoInput {
  empleado: string
  fecha: string
  hora_inicio?: string | null
  hora_fin?: string | null
  notas?: string
}
