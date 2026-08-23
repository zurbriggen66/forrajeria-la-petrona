import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Gasto, GastoInput, GastosResumen, Paginated, TipoGasto } from './types'

export const GASTOS_POR_PAGINA = 50

export interface GastosQuery {
  tipo: TipoGasto
  search?: string
  fecha_desde?: string
  fecha_hasta?: string
  page?: number
}

export function useGastos(params: GastosQuery) {
  return useQuery({
    queryKey: ['gastos', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Gasto>>('/finanzas/gastos/', {
        params: { page_size: GASTOS_POR_PAGINA, ...params },
      })
      return data
    },
    placeholderData: (previa) => previa,
  })
}

/** Totales del período completo para las tarjetas de arriba. Va aparte del
 * listado porque el listado está paginado: sumar las filas de la página daría
 * un total distinto en cada página. */
export function useGastosResumen(params: Omit<GastosQuery, 'page'>) {
  return useQuery({
    queryKey: ['gastos-resumen', params],
    queryFn: async () => {
      const { data } = await api.get<GastosResumen>('/finanzas/gastos/resumen/', { params })
      return data
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
