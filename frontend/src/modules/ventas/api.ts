import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Paginated, Venta, Vendedor, VentasFiltros } from './types'

/** Ventas por página en el historial. El historial crece indefinidamente, así
 * que se pagina de verdad en vez de traer un tope arbitrario. */
export const VENTAS_POR_PAGINA = 50

export function useVentas(filtros: VentasFiltros = {}) {
  return useQuery({
    queryKey: ['ventas', filtros],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Venta>>('/ventas/', {
        params: { page_size: VENTAS_POR_PAGINA, ordering: '-created_at', ...filtros },
      })
      return data
    },
    // Evita que la tabla parpadee a vacío al cambiar de página.
    placeholderData: (previa) => previa,
  })
}

export function useVendedores() {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Vendedor>>('/auth/vendedores/', { params: { page_size: 100 } })
      return data.results
    },
  })
}

/** Todo lo que cambia cuando se anula o se corrige una venta.
 *
 * Anular devuelve el stock, revierte el arqueo de la caja y —si estaba fiada—
 * le baja la deuda al cliente. El backend hacía las tres cosas bien, pero acá
 * sólo se refrescaban las ventas y las estadísticas: el dueño anulaba una venta
 * fiada, iba a la ficha del cliente y seguía viendo la deuda vieja. Desde su
 * lado eso es "no descontó el monto", y no había forma de distinguirlo de un
 * bug de verdad hasta recargar la página a mano. */
const CLAVES_AFECTADAS = [
  ['ventas'], ['estadisticas'], ['inicio'],
  ['cliente-movimientos'], ['clientes-listado'], ['clientes'],
  ['cuenta-corriente-auditoria'],
  ['productos'], ['inventario-resumen'],
  ['caja-actual'], ['caja-movimientos'],
]

/** Lo que el backend contesta después de anular o corregir: además de la venta,
 * cómo quedaron el saldo del cliente y el stock.
 *
 * Se muestra en el momento a propósito. Las dos operaciones mueven deuda y
 * stock de una sola pasada, y la única forma de comprobar que quedó bien era ir
 * a buscar el producto y la ficha del cliente a mano. */
export interface VerificacionVenta {
  saldo: {
    saldo: string
    saldo_calculado: string
    coincide: boolean
    diferencia: string
  } | null
  stock: { producto: string; nombre: string; delta: string; stock_actual: string }[]
}

export type VentaConVerificacion = Venta & { verificacion: VerificacionVenta }

export function useAnularVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await api.post<VentaConVerificacion>(`/ventas/${id}/anular/`, { motivo })
      return data
    },
    onSuccess: () => {
      CLAVES_AFECTADAS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    },
  })
}

export interface VentaItemEditInput {
  producto: string
  cantidad: string
  es_bolsa?: boolean
  descuento_pct?: string
}

/** Corrige los productos de una venta fiada ya cobrada (ver
 * VentaViewSet.editar_items en el backend): la diferencia le pega a la
 * cuenta corriente del cliente, no a la caja del día. */
export function useEditarItemsVenta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      { id, items, motivo }: { id: string; items: VentaItemEditInput[]; motivo: string },
    ) => {
      const { data } = await api.post<VentaConVerificacion>(
        `/ventas/${id}/editar_items/`, { items, motivo },
      )
      return data
    },
    onSuccess: () => {
      // Corregir los ítems mueve la deuda del cliente y el stock igual que
      // anular: se refresca lo mismo.
      CLAVES_AFECTADAS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    },
  })
}
