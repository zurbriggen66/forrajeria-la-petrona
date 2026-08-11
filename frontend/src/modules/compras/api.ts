import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Compra, CompraFiltros, CompraInput, Paginated } from './types'

export function useCompras(filtros: CompraFiltros = {}) {
  return useQuery({
    queryKey: ['compras', filtros],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Compra>>('/compras/', { params: { page_size: 50, ...filtros } })
      return data.results
    },
  })
}

export function useCreateCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CompraInput) => {
      const { data } = await api.post<Compra>('/compras/', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] })
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
    },
  })
}
