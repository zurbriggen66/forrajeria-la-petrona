import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Compra, CompraFiltros, CompraInput, CompraPago, CompraPagoInput, Paginated, UltimaCompraProducto } from './types'

/** Todo lo que cambia cuando entra plata o mercadería: la compra, el saldo del
 * proveedor, el stock, la caja y los números del Inicio. */
const CLAVES_AFECTADAS = [
  ['compras'], ['proveedores'], ['productos'], ['caja-actual'], ['caja-movimientos'], ['inicio'],
]

export function useCompras(filtros: CompraFiltros = {}) {
  return useQuery({
    queryKey: ['compras', filtros],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Compra>>('/compras/', { params: { page_size: 50, ...filtros } })
      return data.results
    },
  })
}

export function useCreateCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CompraInput) => {
      const { data } = await api.post<Compra>('/compras/', input)
      return data
    },
    onSuccess: () => CLAVES_AFECTADAS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey })),
  })
}

/** Registrar un pago (total o parcial) de una compra fiada. */
export function usePagarCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CompraPagoInput }) => {
      const { data } = await api.post<{ pago: CompraPago; compra: Compra }>(`/compras/${id}/pagar/`, input)
      return data
    },
    onSuccess: () => CLAVES_AFECTADAS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey })),
  })
}

/** Última compra de un producto, para mostrar al lado de lo que se está
 * cargando: es lo que deja ver de una si el proveedor aumentó.
 *
 * Se pide sólo cuando hay un producto elegido, y queda fresca 5 minutos: es un
 * dato histórico, no cambia mientras se carga la compra.
 */
export function useUltimaCompraProducto(productoId: string | null) {
  return useQuery({
    queryKey: ['ultima-compra-producto', productoId],
    queryFn: async () => {
      const { data } = await api.get<UltimaCompraProducto | null>('/compras/ultima-de-producto/', {
        params: { producto: productoId },
      })
      return data
    },
    enabled: Boolean(productoId),
    staleTime: 5 * 60 * 1000,
  })
}
