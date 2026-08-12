import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Paginated, Turno, TurnoInput } from './types'

export function useTurnos() {
  return useQuery({
    queryKey: ['empleados-turnos'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Turno>>('/auth/empleados-turnos/', { params: { page_size: 500 } })
      return data.results
    },
  })
}

export function useCreateTurno() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TurnoInput) => {
      const { data } = await api.post<Turno>('/auth/empleados-turnos/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['empleados-turnos'] }),
  })
}

export function useUpdateTurno() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: TurnoInput & { id: string }) => {
      const { data } = await api.patch<Turno>(`/auth/empleados-turnos/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['empleados-turnos'] }),
  })
}

export function useDeleteTurno() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/empleados-turnos/${id}/`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['empleados-turnos'] }),
  })
}
