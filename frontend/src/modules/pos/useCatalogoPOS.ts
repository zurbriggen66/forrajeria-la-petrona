import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Paginated, Producto } from '../productos/types'

const CACHE_KEY = 'tienda-ia-catalogo-pos'

function leerCache(): Producto[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Producto[]) : []
  } catch {
    return []
  }
}

function guardarCache(productos: Producto[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(productos))
  } catch {
    // localStorage lleno o no disponible: no es crítico, seguimos sin cache.
  }
}

/** Catálogo para el buscador del POS. Intenta traerlo fresco del servidor;
 * si falla (sin conexión), usa la última copia guardada en el navegador para
 * que se pueda seguir vendiendo offline. */
export function useCatalogoPOS() {
  const [productos, setProductos] = useState<Producto[]>(() => leerCache())
  const [loading, setLoading] = useState(true)
  const [desdeCache, setDesdeCache] = useState(false)

  useEffect(() => {
    let cancelado = false
    api
      .get<Paginated<Producto>>('/productos/', { params: { activo: true, page_size: 500 } })
      .then(({ data }) => {
        if (cancelado) return
        setProductos(data.results)
        guardarCache(data.results)
        setDesdeCache(false)
      })
      .catch(() => {
        if (cancelado) return
        setProductos(leerCache())
        setDesdeCache(true)
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  return { productos, loading, desdeCache }
}
