import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export interface InventarioResumen {
  total_productos: number
  valor_stock_costo: string
  valor_stock_venta: string
  stock_bajo_count: number
  sin_stock_count: number
}

export interface RankingItem {
  id: string
  nombre: string
  categoria: string
  precio_costo: string
  precio_venta: string
  margen_pct: number
  stock: string
}

export function useInventarioResumen() {
  return useQuery({
    queryKey: ['inventario-resumen'],
    queryFn: async () => {
      const { data } = await api.get<InventarioResumen>('/inventario/resumen/')
      return data
    },
  })
}

export function useRankingRentabilidad() {
  return useQuery({
    queryKey: ['inventario-ranking'],
    queryFn: async () => {
      const { data } = await api.get<RankingItem[]>('/inventario/ranking-rentabilidad/')
      return data
    },
  })
}
