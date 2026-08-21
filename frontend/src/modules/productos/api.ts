import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  AjustePrecio,
  AplicarAjusteInput,
  Categoria,
  Combo,
  Paginated,
  Producto,
  ProductoInput,
  ProductoUniversal,
  Proveedor,
} from './types'

export interface ProductosQuery {
  search?: string
  categoria?: string
  stock_status?: 'bajo' | 'sin_stock'
  activo?: boolean
  ordering?: string
}

export function useProductos(params: ProductosQuery = {}) {
  return useQuery({
    queryKey: ['productos', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Producto>>('/productos/', { params: { page_size: 100, ...params } })
      return data
    },
  })
}

/** Búsqueda liviana server-side para elegir un producto puntual (Compras,
 * Pedidos, Transferencia de stock…): con catálogos de miles de productos,
 * un <select> con todo el catálogo cargado es inviable — esto sólo trae
 * unos pocos resultados por término de búsqueda. */
export function useProductoSearch(query: string) {
  return useQuery({
    queryKey: ['productos-search', query],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Producto>>('/productos/', {
        params: { page_size: 8, search: query, activo: true, ordering: 'nombre' },
      })
      return data.results
    },
    enabled: query.trim().length >= 2,
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias-productos'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Categoria>>('/categorias-productos/', { params: { page_size: 100 } })
      return data.results
    },
  })
}

export function useProveedores() {
  return useQuery({
    queryKey: ['proveedores'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Proveedor>>('/proveedores/', { params: { page_size: 100, activo: true } })
      return data.results
    },
  })
}

export function buscarProductoUniversal(codigoBarras: string) {
  return api
    .get<Paginated<ProductoUniversal>>('/productos-universal/', { params: { codigo_barras: codigoBarras } })
    .then((res) => res.data.results[0] ?? null)
}

export function useCreateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProductoInput) => {
      const { data } = await api.post<Producto>('/productos/', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['inventario-resumen'] })
    },
  })
}

export function useUpdateProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProductoInput }) => {
      const { data } = await api.patch<Producto>(`/productos/${id}/`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['inventario-resumen'] })
    },
  })
}

export function useDeleteProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/productos/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['inventario-resumen'] })
    },
  })
}

export function useCombos() {
  return useQuery({
    queryKey: ['combos'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Combo>>('/combos/', { params: { page_size: 100 } })
      return data.results
    },
  })
}

export function useCreateCombo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { nombre: string; descripcion?: string; precio: string; items: { producto: string; cantidad: string }[] }) => {
      const { data } = await api.post<Combo>('/combos/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['combos'] }),
  })
}

export function useAjustesPrecios() {
  return useQuery({
    queryKey: ['ajustes-precios'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<AjustePrecio>>('/ajustes-precios/', { params: { page_size: 50 } })
      return data.results
    },
  })
}

export function useAplicarAjuste() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AplicarAjusteInput) => {
      const { data } = await api.post<AjustePrecio>('/ajustes-precios/', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-precios'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['inventario-resumen'] })
    },
  })
}
