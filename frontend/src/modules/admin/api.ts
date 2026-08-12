import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ErrorLogEntry, Paginated, Sucursal, SucursalBloqueoInput, SucursalInput } from './types'

export function useSucursales() {
  return useQuery({
    queryKey: ['admin-sucursales'],
    queryFn: async () => {
      const { data } = await api.get<Sucursal[]>('/admin/comercios/')
      return data
    },
  })
}

export function useCrearSucursal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SucursalInput) => {
      const { data } = await api.post<Sucursal>('/admin/comercios/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sucursales'] }),
  })
}

export function useActualizarSucursal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<SucursalInput> & Partial<SucursalBloqueoInput>) => {
      const { data } = await api.patch<Sucursal>(`/admin/comercios/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sucursales'] }),
  })
}

export function useErrorLogs() {
  return useQuery({
    queryKey: ['admin-error-logs'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<ErrorLogEntry>>('/admin/error-logs/', { params: { page_size: 20 } })
      return data.results
    },
  })
}
