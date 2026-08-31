import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  AjustePrecio,
  AplicarAjusteInput,
  Categoria,
  Combo,
  ComboInput,
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
  page?: number
  page_size?: number
}

/** Cuántos productos por página en los listados. El catálogo real tiene miles
 * de ítems, así que la lista se pagina de verdad (ver componente Paginacion);
 * traerlos todos de una colgaba la tabla. */
export const PRODUCTOS_POR_PAGINA = 50

export function useProductos(params: ProductosQuery = {}) {
  return useQuery({
    queryKey: ['productos', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Producto>>('/productos/', {
        params: { page_size: PRODUCTOS_POR_PAGINA, ...params },
      })
      return data
    },
    // Mantener la página anterior mientras carga la siguiente evita que la
    // tabla parpadee a vacío en cada click de paginado.
    placeholderData: (previa) => previa,
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
    // Con una letra alcanza: en un catálogo de miles, "b" ya descarta casi
    // todo, y obligar a dos hacía que el primer caracter pareciera no hacer nada.
    enabled: query.trim().length >= 1,
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

/** `activo` filtra: el POS sólo ofrece los packs activos, la pantalla de packs
 * los muestra todos. */
export function useCombos(activo?: boolean) {
  return useQuery({
    queryKey: ['combos', activo ?? 'todos'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Combo>>('/combos/', {
        params: { page_size: 100, ...(activo === undefined ? {} : { activo }) },
      })
      return data.results
    },
  })
}

export function useCreateCombo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ComboInput) => {
      const { data } = await api.post<Combo>('/combos/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['combos'] }),
  })
}

/** Editar un pack ya armado. El endpoint existía desde siempre
 * (ComboSerializer.update reemplaza los ítems), pero el front nunca lo llamaba:
 * un pack mal cargado había que borrarlo y rehacerlo. */
export function useUpdateCombo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ComboInput }) => {
      const { data } = await api.put<Combo>(`/combos/${id}/`, input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['combos'] }),
  })
}

export function useDeleteCombo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/combos/${id}/`)
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
