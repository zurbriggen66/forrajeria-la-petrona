import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { VentasFiltros } from '../ventas/types'
import type { Rankings, RentabilidadProducto, Resumen, VerdadDelNegocio } from './types'

export function useResumen(filtros: VentasFiltros) {
  return useQuery({
    queryKey: ['estadisticas', 'resumen', filtros],
    queryFn: async () => {
      const { data } = await api.get<Resumen>('/estadisticas/resumen/', { params: filtros })
      return data
    },
  })
}

export function useRankings(filtros: VentasFiltros) {
  return useQuery({
    queryKey: ['estadisticas', 'rankings', filtros],
    queryFn: async () => {
      const { data } = await api.get<Rankings>('/estadisticas/rankings/', { params: filtros })
      return data
    },
  })
}

export function useRentabilidad(filtros: VentasFiltros) {
  return useQuery({
    queryKey: ['estadisticas', 'rentabilidad', filtros],
    queryFn: async () => {
      const { data } = await api.get<RentabilidadProducto[]>('/estadisticas/rentabilidad/', { params: filtros })
      return data
    },
  })
}

export function useVerdadDelNegocio(filtros: VentasFiltros) {
  return useQuery({
    queryKey: ['estadisticas', 'verdad-del-negocio', filtros],
    queryFn: async () => {
      const { data } = await api.get<VerdadDelNegocio>('/estadisticas/verdad-del-negocio/', { params: filtros })
      return data
    },
  })
}
