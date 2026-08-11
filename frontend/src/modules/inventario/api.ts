import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Deposito {
  id: string
  nombre: string
  direccion: string
  activo: boolean
}

export interface DepositoInput {
  nombre: string
  direccion: string
  activo: boolean
}

export interface StockDeposito {
  id: string
  deposito: string
  deposito_nombre: string
  producto: string
  producto_nombre: string
  stock: string
}

export interface TransferenciaStockInput {
  producto: string
  cantidad: string
  origen: string // "central" o id de depósito
  destino: string
}

export function useDepositos() {
  return useQuery({
    queryKey: ['depositos'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Deposito>>('/inventario/depositos/', { params: { page_size: 50 } })
      return data.results
    },
  })
}

export function useCreateDeposito() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: DepositoInput) => {
      const { data } = await api.post<Deposito>('/inventario/depositos/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['depositos'] }),
  })
}

export function useStockDeposito(depositoId?: string) {
  return useQuery({
    queryKey: ['stock-deposito', depositoId],
    queryFn: async () => {
      const { data } = await api.get<Paginated<StockDeposito>>('/inventario/stock-deposito/', {
        params: { page_size: 200, ...(depositoId ? { deposito: depositoId } : {}) },
      })
      return data.results
    },
  })
}

export function useTransferirStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TransferenciaStockInput) => {
      await api.post('/inventario/stock-deposito/transferir/', input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-deposito'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['inventario-resumen'] })
    },
  })
}

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
