import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  Cliente,
  ClienteAsignacion,
  ClienteInput,
  ClienteMovimiento,
  ClienteMovimientoInput,
  EstadisticasClientes,
  MovimientoAuditoria,
  Paginated,
} from './types'

export interface ClientesQuery {
  search?: string
  activo?: boolean
  /** Filtra por saldo de cuenta corriente. Se resuelve en el servidor: sobre
   * la lista paginada, filtrar en el navegador daría un resultado falso. */
  deuda?: 'deben' | 'al_dia'
  ordering?: string
  page?: number
}

export const CLIENTES_POR_PAGINA = 50

export function useClientes(params: ClientesQuery = {}) {
  return useQuery({
    queryKey: ['clientes-listado', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Cliente>>('/clientes/', {
        params: { page_size: CLIENTES_POR_PAGINA, ...params },
      })
      return data
    },
    placeholderData: (previa) => previa,
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

export function useEliminarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clientes/${id}/`)
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
      // El pago entra (o sale) del cajón: sin esto el arqueo en pantalla
      // quedaba con el número viejo hasta recargar.
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente-auditoria'] })
    },
  })
}

export function useEditarMovimientoCliente(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // `motivo` es obligatorio del lado del servidor: esto le cambia el saldo a
    // un cliente y queda registrado quién y por qué.
    mutationFn: async ({ id, input }: {
      id: string
      input: { monto: string; referencia?: string; medio_pago?: string; motivo: string }
    }) => {
      const { data } = await api.patch<ClienteMovimiento>(`/clientes/${clienteId}/movimientos/${id}/`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', clienteId] })
      queryClient.invalidateQueries({ queryKey: ['clientes-listado'] })
      // El pago entra (o sale) del cajón: sin esto el arqueo en pantalla
      // quedaba con el número viejo hasta recargar.
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente-auditoria'] })
    },
  })
}

export function useEliminarMovimientoCliente(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      // DELETE con cuerpo: es lo que espera el backend para el motivo, y axios
      // lo manda sólo si va en `data`.
      await api.delete(`/clientes/${clienteId}/movimientos/${id}/`, { data: { motivo } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', clienteId] })
      queryClient.invalidateQueries({ queryKey: ['clientes-listado'] })
      // El pago entra (o sale) del cajón: sin esto el arqueo en pantalla
      // quedaba con el número viejo hasta recargar.
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente-auditoria'] })
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

/** El registro de ediciones y borrados de cuentas corrientes.
 *
 * Sin `desde` el backend devuelve la última semana, que es la ventana con la
 * que se trabaja. Nada se borra solo: lo viejo se archiva con el comando
 * clientes_auditoria_archivar. */
export function useAuditoriaCuentaCorriente(clienteId?: string, desde?: string) {
  return useQuery({
    queryKey: ['cuenta-corriente-auditoria', clienteId ?? 'todos', desde ?? 'semana'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<MovimientoAuditoria>>('/clientes/auditoria/', {
        params: { page_size: 100, cliente: clienteId, desde },
      })
      return data.results
    },
  })
}

/** Los números de la cartera de clientes.
 *
 * `staleTime` de 2 minutos: son agregados de todo el historial, no cambian con
 * cada venta, y recalcularlos en cada foco de la pestaña es trabajo al servidor
 * por nada. */
export function useEstadisticasClientes(diasDormido?: number) {
  return useQuery({
    queryKey: ['clientes-estadisticas', diasDormido ?? 60],
    queryFn: async () => {
      const { data } = await api.get<EstadisticasClientes>('/clientes/estadisticas/', {
        params: { dias_dormido: diasDormido },
      })
      return data
    },
    staleTime: 2 * 60 * 1000,
  })
}
