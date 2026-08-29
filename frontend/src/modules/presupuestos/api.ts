import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { EstadoPresupuesto, Paginated, Presupuesto, PresupuestoFiltros, PresupuestoInput } from './types'

export function usePresupuestos(filtros: PresupuestoFiltros = {}) {
  return useQuery({
    queryKey: ['presupuestos', filtros],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Presupuesto>>('/presupuestos/', {
        params: { page_size: 100, ...filtros },
      })
      return data.results
    },
  })
}

export function useCreatePresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PresupuestoInput) => {
      const { data } = await api.post<Presupuesto>('/presupuestos/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presupuestos'] }),
  })
}

export function useUpdatePresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PresupuestoInput }) => {
      const { data } = await api.put<Presupuesto>(`/presupuestos/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presupuestos'] }),
  })
}

export function useCambiarEstadoPresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      { id, estado, venta }: { id: string; estado: EstadoPresupuesto; venta?: string },
    ) => {
      const { data } = await api.post<Presupuesto>(`/presupuestos/${id}/estado/`, { estado, venta })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestos'] })
      // Al cobrar (venta presente) esto también movió ventas, estadísticas
      // y, si fue a cuenta corriente, la deuda del cliente.
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      queryClient.invalidateQueries({ queryKey: ['estadisticas'] })
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['clientes-listado'] })
    },
  })
}

export function useDeletePresupuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/presupuestos/${id}/`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presupuestos'] }),
  })
}
