import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '../../lib/api'
import type { Paginated } from '../productos/types'
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
