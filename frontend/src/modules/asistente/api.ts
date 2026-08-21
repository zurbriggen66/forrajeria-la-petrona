import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Cuota, CuentaAsistente, RespuestaConfirmacion, RespuestaConsulta, TurnoApi } from './types'

export function useCuotaAsistente() {
  return useQuery({
    queryKey: ['asistente-uso'],
    queryFn: async () => {
      const { data } = await api.get<Cuota>('/asistente/uso/')
      return data
    },
  })
}

export function useConsultarAsistente() {
  return useMutation({
    mutationFn: async ({ mensaje, historial }: { mensaje: string; historial: TurnoApi[] }) => {
      // Pensar + consultar la base lleva más que un request normal; el default
      // del cliente cortaría la respuesta antes de tiempo.
      const { data } = await api.post<RespuestaConsulta>(
        '/asistente/consultar/', { mensaje, historial }, { timeout: 120_000 },
      )
      return data
    },
  })
}

export function useConfirmarAccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ accion, confirmar }: { accion: string; confirmar: boolean }) => {
      const { data } = await api.post<RespuestaConfirmacion>('/asistente/confirmar/', { accion, confirmar })
      return data
    },
    onSuccess: () => {
      // Confirmar puede haber creado un producto o una venta: se refresca todo
      // lo que eso toca para que las pantallas abiertas no queden desfasadas.
      for (const key of [['productos'], ['ventas'], ['inventario-resumen'], ['caja-actual'], ['caja-movimientos'], ['estadisticas']]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}

export function useCuentaAsistente() {
  return useQuery({
    queryKey: ['asistente-cuenta'],
    queryFn: async () => {
      const { data } = await api.get<CuentaAsistente>('/asistente/cuenta/')
      return data
    },
  })
}

export function useGuardarCuentaAsistente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { api_key?: string; modelo?: string }) => {
      const { data } = await api.post<CuentaAsistente>('/asistente/cuenta/', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asistente-cuenta'] })
      queryClient.invalidateQueries({ queryKey: ['asistente-uso'] })
    },
  })
}
