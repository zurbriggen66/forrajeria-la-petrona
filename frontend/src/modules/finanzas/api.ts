import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Gasto, GastoInput, Paginated } from './types'

export function useGastos() {
  return useQuery({
    queryKey: ['gastos'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Gasto>>('/finanzas/gastos/', { params: { page_size: 50 } })
      return data.results
    },
  })
}

export function useCreateGasto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: GastoInput) => {
      const { data } = await api.post<Gasto>('/finanzas/gastos/', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] })
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
    },
  })
}
