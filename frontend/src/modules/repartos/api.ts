import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { EstadoReparto, Paginated, Reparto, RepartoFiltros, RepartoInput } from './types'

export function useRepartos(filtros: RepartoFiltros = {}) {
  return useQuery({
    queryKey: ['repartos', filtros],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Reparto>>('/repartos/', {
        params: { page_size: 100, ...filtros },
      })
      return data.results
    },
  })
}

export function useCreateReparto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RepartoInput) => {
      const { data } = await api.post<Reparto>('/repartos/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repartos'] }),
  })
}

export function useUpdateReparto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RepartoInput }) => {
      const { data } = await api.put<Reparto>(`/repartos/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repartos'] }),
  })
}

export function useCambiarEstadoReparto() {
  const queryClient = useQueryClient()
  return useMutation({
    // `venta` sólo va al facturar: la venta ya se creó por POST /ventas/ y esto
    // la linkea al reparto (ver RepartoCobrarModal).
    mutationFn: async ({ id, estado, venta }: { id: string; estado: EstadoReparto; venta?: string }) => {
      const { data } = await api.post<Reparto>(`/repartos/${id}/estado/`, { estado, venta })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repartos'] }),
  })
}

export function useDeleteReparto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/repartos/${id}/`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repartos'] }),
  })
}
