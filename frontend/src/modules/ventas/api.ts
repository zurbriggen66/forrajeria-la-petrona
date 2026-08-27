import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Paginated, Venta, Vendedor, VentasFiltros } from './types'

/** Ventas por página en el historial. El historial crece indefinidamente, así
 * que se pagina de verdad en vez de traer un tope arbitrario. */
export const VENTAS_POR_PAGINA = 50

export function useVentas(filtros: VentasFiltros = {}) {
  return useQuery({
    queryKey: ['ventas', filtros],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Venta>>('/ventas/', {
        params: { page_size: VENTAS_POR_PAGINA, ordering: '-created_at', ...filtros },
      })
      return data
    },
    // Evita que la tabla parpadee a vacío al cambiar de página.
    placeholderData: (previa) => previa,
  })
}

export function useVendedores() {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Vendedor>>('/auth/vendedores/', { params: { page_size: 100 } })
      return data.results
    },
  })
}

export function useAnularVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await api.post<Venta>(`/ventas/${id}/anular/`, { motivo })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      queryClient.invalidateQueries({ queryKey: ['estadisticas'] })
    },
  })
}

export interface VentaItemEditInput {
  producto: string
  cantidad: string
  es_bolsa?: boolean
  descuento_pct?: string
}

/** Corrige los productos de una venta fiada ya cobrada (ver
 * VentaViewSet.editar_items en el backend): la diferencia le pega a la
 * cuenta corriente del cliente, no a la caja del día. */
export function useEditarItemsVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, items }: { id: string; items: VentaItemEditInput[] }) => {
      const { data } = await api.post<Venta>(`/ventas/${id}/editar_items/`, { items })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
      queryClient.invalidateQueries({ queryKey: ['estadisticas'] })
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['clientes-listado'] })
    },
  })
}
