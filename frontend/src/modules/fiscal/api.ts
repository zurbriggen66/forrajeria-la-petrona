import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { VentaResult } from '../pos/types'
import type { FiscalConfig, FiscalConfigInput, FiscalQueueItem, Paginated } from './types'

export function useFiscalConfig() {
  return useQuery({
    queryKey: ['fiscal-config'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<FiscalConfig>>('/fiscal/config/', { params: { page_size: 5 } })
      return data.results[0] ?? null
    },
  })
}

export function useGuardarFiscalConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FiscalConfigInput> & { id?: string }) => {
      const { data } = id
        ? await api.patch<FiscalConfig>(`/fiscal/config/${id}/`, input)
        : await api.post<FiscalConfig>('/fiscal/config/', { es_principal: true, activo: true, ...input })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-config'] }),
  })
}

export function useColaFiscal() {
  return useQuery({
    queryKey: ['fiscal-cola'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<FiscalQueueItem>>('/fiscal/cola/', { params: { page_size: 100 } })
      return data.results
    },
  })
}

export function useFacturarVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ventaId: string) => {
      const { data } = await api.post<VentaResult>(`/ventas/${ventaId}/facturar/`)
      return data
    },
    // onSettled (no solo onSuccess): un rechazo de ARCA también deja una fila
    // nueva en la cola (status "error"), la vista tiene que reflejarla igual.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-cola'] })
      queryClient.invalidateQueries({ queryKey: ['ventas'] })
    },
  })
}
