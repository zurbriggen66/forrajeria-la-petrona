import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { VentasFiltros } from '../ventas/types'
import type { Deudas, MesContable, ResultadoContable } from './types'

export function useResultadoContable(filtros: VentasFiltros) {
  return useQuery({
    queryKey: ['contabilidad', 'resultado', filtros],
    queryFn: async () => {
      const { data } = await api.get<ResultadoContable>('/estadisticas/contabilidad/resultado/', { params: filtros })
      return data
    },
  })
}

export function useMensual(meses = 12) {
  return useQuery({
    queryKey: ['contabilidad', 'mensual', meses],
    queryFn: async () => {
      const { data } = await api.get<{ meses: MesContable[] }>('/estadisticas/contabilidad/mensual/', {
        params: { meses },
      })
      return data.meses
    },
  })
}

export function useDeudas() {
  return useQuery({
    queryKey: ['contabilidad', 'deudas'],
    queryFn: async () => {
      const { data } = await api.get<Deudas>('/estadisticas/contabilidad/deudas/')
      return data
    },
  })
}
