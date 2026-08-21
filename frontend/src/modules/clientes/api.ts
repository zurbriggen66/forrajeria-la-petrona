import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  Cliente,
  ClienteAsignacion,
  ClienteInput,
  ClienteMovimiento,
  ClienteMovimientoInput,
  Paginated,
} from './types'

export interface ClientesQuery {
  search?: string
  activo?: boolean
  ordering?: string
}

export function useClientes(params: ClientesQuery = {}) {
  return useQuery({
    queryKey: ['clientes-listado', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Cliente>>('/clientes/', { params: { page_size: 100, ...params } })
      return data
    },
  })
}

export function useCreateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClienteInput) => {
      const { data } = await api.post<Cliente>('/clientes/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes-listado'] }),
  })
}

export function useUpdateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ClienteInput }) => {
      const { data } = await api.patch<Cliente>(`/clientes/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes-listado'] }),
  })
}

export function useMovimientosCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-movimientos', clienteId],
    queryFn: async () => {
      const { data } = await api.get<ClienteMovimiento[]>(`/clientes/${clienteId}/movimientos/`)
      return data
    },
    enabled: Boolean(clienteId),
  })
}

export function useCrearMovimientoCliente(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClienteMovimientoInput) => {
      const { data } = await api.post<ClienteMovimiento>(`/clientes/${clienteId}/movimientos/nuevo/`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', clienteId] })
      queryClient.invalidateQueries({ queryKey: ['clientes-listado'] })
    },
  })
}

export function useEditarMovimientoCliente(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: { monto: string; referencia?: string; medio_pago?: string } }) => {
      const { data } = await api.patch<ClienteMovimiento>(`/clientes/${clienteId}/movimientos/${id}/`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', clienteId] })
      queryClient.invalidateQueries({ queryKey: ['clientes-listado'] })
    },
  })
}

export function useEliminarMovimientoCliente(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clientes/${clienteId}/movimientos/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', clienteId] })
      queryClient.invalidateQueries({ queryKey: ['clientes-listado'] })
    },
  })
}

export function useAsignacionesCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['cliente-asignaciones', clienteId],
    queryFn: async () => {
      const { data } = await api.get<Paginated<ClienteAsignacion>>('/clientes-asignaciones/', {
        params: { cliente: clienteId, page_size: 20, ordering: '-created_at' },
      })
      return data.results
    },
    enabled: Boolean(clienteId),
  })
}

export function useAsignarVendedor(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vendedor: string) => {
      const { data } = await api.post<ClienteAsignacion>('/clientes-asignaciones/', {
        cliente: clienteId, vendedor, activo: true,
      })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cliente-asignaciones', clienteId] }),
  })
}

export function useDesactivarAsignacion(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (asignacionId: string) => {
      const { data } = await api.patch<ClienteAsignacion>(`/clientes-asignaciones/${asignacionId}/`, { activo: false })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cliente-asignaciones', clienteId] }),
  })
}
