import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Inicio } from './types'

export function useInicio() {
  return useQuery({
    queryKey: ['inicio'],
    queryFn: async () => {
      const { data } = await api.get<Inicio>('/estadisticas/inicio/')
      return data
    },
    // Es la pantalla que queda abierta todo el día en el mostrador: que se
    // refresque sola cada par de minutos evita que muestre números viejos.
    refetchInterval: 120_000,
  })
}
