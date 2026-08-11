import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  MovimientoProveedorInput,
  PedidoManual,
  PedidoSugerido,
  Paginated,
  Proveedor,
  ProveedorInput,
  ProveedorMovimiento,
} from './types'

export function useProveedores(params: { activo?: boolean; search?: string } = {}) {
  return useQuery({
    queryKey: ['proveedores', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Proveedor>>('/proveedores/', { params: { page_size: 100, ...params } })
      return data.results
    },
  })
}

export function useCreateProveedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProveedorInput) => {
      const { data } = await api.post<Proveedor>('/proveedores/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proveedores'] }),
  })
}

export function useUpdateProveedor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProveedorInput }) => {
      const { data } = await api.patch<Proveedor>(`/proveedores/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proveedores'] }),
  })
}

export function useMovimientosProveedor(proveedorId: string | undefined) {
  return useQuery({
    queryKey: ['proveedor-movimientos', proveedorId],
    queryFn: async () => {
      const { data } = await api.get<ProveedorMovimiento[]>(`/proveedores/${proveedorId}/movimientos/`)
      return data
    },
    enabled: Boolean(proveedorId),
  })
}

export function useCrearMovimientoProveedor(proveedorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: MovimientoProveedorInput) => {
      const { data } = await api.post<ProveedorMovimiento>(`/proveedores/${proveedorId}/movimientos/nuevo/`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedor-movimientos', proveedorId] })
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
    },
  })
}

export function usePedidosSugeridos() {
  return useQuery({
    queryKey: ['pedidos-sugeridos'],
    queryFn: async () => {
      const { data } = await api.get<PedidoSugerido[]>('/pedidos/sugeridos/')
      return data
    },
  })
}

export function usePedidosManuales() {
  return useQuery({
    queryKey: ['pedidos-manuales'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<PedidoManual>>('/pedidos/manuales/', { params: { page_size: 50 } })
      return data.results
    },
  })
}

export function useCrearPedidoManual() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (detalle: PedidoManual['detalle']) => {
      const { data } = await api.post<PedidoManual>('/pedidos/manuales/', { detalle, estado: 'pendiente' })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos-manuales'] }),
  })
}

export function useActualizarEstadoPedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { data } = await api.patch<PedidoManual>(`/pedidos/manuales/${id}/`, { estado })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos-manuales'] }),
  })
}
