export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type EstadoLead = 'nuevo' | 'contactado' | 'negociando' | 'ganado' | 'perdido'

export interface CrmLead {
  id: string
  nombre: string
  telefono: string
  email: string
  estado: EstadoLead
  notas: string
  created_at: string
  updated_at: string
}

export interface CrmLeadInput {
  nombre: string
  telefono: string
  email: string
  estado: EstadoLead
  notas: string
}
