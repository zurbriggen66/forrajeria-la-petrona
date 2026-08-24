import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  CajaMovimiento,
  CajaSesion,
  CajaSesionActual,
  ConteoInput,
  CuentaPago,
  MovimientoInput,
  Paginated,
  TransferenciaInput,
} from './types'

// La caja actual se consulta seguido (POS, Statusbar, Control de Caja): un
// refetch corto la mantiene fresca sin abusar de la red.
export function useCajaActual() {
  return useQuery({
    queryKey: ['caja-actual'],
    queryFn: async () => {
      const { data } = await api.get<CajaSesionActual | null>('/caja/sesiones/actual/')
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useSesiones() {
  return useQuery({
    queryKey: ['caja-sesiones'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<CajaSesion>>('/caja/sesiones/', { params: { page_size: 50 } })
      return data.results
    },
  })
}

export function useAbrirCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (monto_apertura: string) => {
      const { data } = await api.post<CajaSesion>('/caja/sesiones/abrir/', { monto_apertura })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['caja-sesiones'] })
    },
  })
}

export function useCerrarCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, conteos }: { id: string; conteos: ConteoInput[] }) => {
      const { data } = await api.post<CajaSesion>(`/caja/sesiones/${id}/cerrar/`, { conteos })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
      queryClient.invalidateQueries({ queryKey: ['caja-sesiones'] })
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
    },
  })
}

export function useMovimientos(sesionId: string | undefined) {
  return useQuery({
    queryKey: ['caja-movimientos', sesionId],
    queryFn: async () => {
      const { data } = await api.get<Paginated<CajaMovimiento>>('/caja/movimientos/', {
        params: { sesion: sesionId, page_size: 100 },
      })
      return data.results
    },
    enabled: Boolean(sesionId),
  })
}

export function useCrearMovimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: MovimientoInput) => {
      const { data } = await api.post<CajaMovimiento>('/caja/movimientos/', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
    },
  })
}

export function useTransferir() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TransferenciaInput) => {
      const { data } = await api.post<CajaMovimiento>('/caja/movimientos/transferir/', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] })
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] })
    },
  })
}

export function useCuentasPago(soloActivas = false) {
  return useQuery({
    queryKey: ['cuentas-pago', soloActivas],
    queryFn: async () => {
      const { data } = await api.get<Paginated<CuentaPago>>('/cuentas-pago/', {
        params: { page_size: 50, ...(soloActivas ? { activo: true } : {}) },
      })
      return data.results
    },
  })
}

export interface CuentaPagoInput {
  nombre: string
  tipo: string
  comision_pct: string
  activo: boolean
}

export function useCreateCuentaPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CuentaPagoInput) => {
      const { data } = await api.post<CuentaPago>('/cuentas-pago/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cuentas-pago'] }),
  })
}

export function useUpdateCuentaPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CuentaPagoInput }) => {
      const { data } = await api.patch<CuentaPago>(`/cuentas-pago/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cuentas-pago'] }),
  })
}
