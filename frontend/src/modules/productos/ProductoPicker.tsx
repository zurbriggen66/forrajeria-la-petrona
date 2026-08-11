import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useProductoSearch } from './api'
import type { Producto } from './types'

interface Props {
  producto: Producto | null
  onSelect: (producto: Producto | null) => void
  placeholder?: string
  autoFocus?: boolean
}

/** Buscador de un producto puntual, liviano a propósito: pensado para
 * catálogos de miles de productos donde cargar todo en un <select> sería
 * lento e inutilizable. Debounce de 250ms + búsqueda server-side. */
export function ProductoPicker({ producto, onSelect, placeholder = 'Buscar por nombre o código…', autoFocus }: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [abierto, setAbierto] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const { data: resultados, isFetching } = useProductoSearch(debounced)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (producto) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
        <span className="truncate text-text">{producto.nombre}</span>
        <button
          type="button" onClick={() => onSelect(null)}
          className="shrink-0 rounded p-0.5 text-text-dim hover:text-danger" aria-label="Quitar producto"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  const mostrarDropdown = abierto && debounced.trim().length >= 2

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-8 pr-3 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {mostrarDropdown && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          {isFetching ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-text-dim">
              <Loader2 size={12} className="animate-spin" /> Buscando…
            </div>
          ) : (resultados ?? []).length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-text-dim">Sin resultados para "{debounced}".</div>
          ) : (
            resultados!.map((p) => (
              <button
                key={p.id} type="button"
                onClick={() => { onSelect(p); setQuery(''); setDebounced(''); setAbierto(false) }}
                className="block w-full border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface-2"
              >
                <div className="text-sm text-text">{p.nombre}</div>
                <div className="text-xs text-text-dim">{p.codigo_barras || 'sin código'} · stock {p.stock}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
