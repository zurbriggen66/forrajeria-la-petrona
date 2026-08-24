import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '../../lib/api'
import { useDebounce } from '../../lib/useDebounce'
import type { Paginated, Producto } from '../productos/types'
import { encolarVenta } from './offlineQueue'
import type { Cliente, CuentaPago, VentaInput, VentaResult } from './types'

export function useCuentasPago() {
  return useQuery({
    queryKey: ['cuentas-pago'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<CuentaPago>>('/cuentas-pago/', { params: { page_size: 20, activo: true } })
      return data.results
    },
  })
}

export function useClientesSearch(search: string) {
  return useQuery({
    queryKey: ['clientes', search],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Cliente>>('/clientes/', { params: { page_size: 10, search, activo: true } })
      return data.results
    },
    enabled: search.length >= 2,
  })
}

/** Para el selector "Ver todos": lista completa y paginada, con o sin texto
 * de búsqueda, para cuando no se acuerda cómo quedó agendado el cliente. */
export function useClientesBrowse(search: string, page: number) {
  return useQuery({
    queryKey: ['clientes-browse', search, page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Cliente>>('/clientes/', {
        params: { page_size: 15, page, activo: true, ...(search ? { search } : {}) },
      })
      return data
    },
    placeholderData: (previa) => previa,
  })
}

export type ResultadoVenta =
  | { status: 'ok'; venta: VentaResult }
  | { status: 'queued' }

/** Registra una venta. Si el POST no llega a destino (sin conexión), la
 * encola en IndexedDB para reintentar cuando vuelva la conexión — el POS
 * nunca se queda "trabado" esperando red. */
export async function crearVenta(input: Omit<VentaInput, 'sync_uuid'>): Promise<ResultadoVenta> {
  const payload: VentaInput = { ...input, sync_uuid: crypto.randomUUID() }
  try {
    const { data } = await api.post<VentaResult>('/ventas/', payload)
    return { status: 'ok', venta: data }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      // El servidor respondió (ej. stock insuficiente): no es un problema de
      // conexión, hay que corregir la venta, no encolarla.
      throw err
    }
    await encolarVenta(payload)
    return { status: 'queued' }
  }
}

/** Busca en TODO el catálogo, contra el servidor.
 *
 * El POS cachea sólo los primeros productos para poder vender sin conexión
 * (useCatalogoPOS), y durante un tiempo el buscador filtraba únicamente sobre
 * esa copia: con 6.482 productos en catálogo, el 92% era imposible de
 * encontrar en el mostrador. `catalogoLocal` queda como respaldo inmediato
 * mientras viaja la request, y como único recurso si no hay red.
 */
export function useBuscarProductosPos(query: string, catalogoLocal: Producto[]) {
  const q = query.trim()
  const diferida = useDebounce(q, 200)

  const { data, isError } = useQuery({
    queryKey: ['pos-buscar-productos', diferida],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Producto>>('/productos/', {
        params: { search: diferida, activo: true, page_size: 20 },
      })
      return data.results
    },
    enabled: diferida.length >= 1,
    placeholderData: (previa) => previa,
  })

  const locales = useMemo(() => {
    const min = q.toLowerCase()
    if (!min) return []
    return catalogoLocal.filter(
      (p) => p.nombre.toLowerCase().includes(min) || p.codigo_barras.includes(min),
    )
  }, [q, catalogoLocal])

  if (!q) return []
  // Sin respuesta del servidor todavía (o sin red) se muestra lo que haya en
  // el catálogo local: el mostrador no puede quedarse esperando.
  const usarServidor = data !== undefined && !isError && diferida === q
  return (usarServidor ? data : locales).slice(0, 8)
}

/** Lookup exacto por código de barras para el lector.
 *
 * El lector tipea y manda Enter más rápido de lo que responde la búsqueda con
 * debounce, así que acá se pregunta directo en vez de esperar. */
export async function buscarProductoPorCodigo(codigo: string): Promise<Producto | null> {
  try {
    const { data } = await api.get<Paginated<Producto>>('/productos/', {
      params: { search: codigo, activo: true, page_size: 5 },
    })
    return data.results.find((p) => p.codigo_barras === codigo) ?? null
  } catch {
    return null
  }
}
