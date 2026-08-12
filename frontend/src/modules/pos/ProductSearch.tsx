import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import type { Producto } from '../productos/types'

interface Props {
  productos: Producto[]
  onAgregar: (producto: Producto) => void
}

export function ProductSearch({ productos, onAgregar }: Props) {
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.codigo_barras.includes(q) || p.plu_balanza === q)
      .slice(0, 8)
  }, [query, productos])

  useEffect(() => {
    setHighlightIndex(0)
  }, [resultados])

  function agregar(producto: Producto) {
    onAgregar(producto)
    setQuery('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      return
    }
    if (e.key === 'ArrowDown') {
      if (resultados.length === 0) return
      e.preventDefault()
      setHighlightIndex((i) => (i + 1) % resultados.length)
      return
    }
    if (e.key === 'ArrowUp') {
      if (resultados.length === 0) return
      e.preventDefault()
      setHighlightIndex((i) => (i - 1 + resultados.length) % resultados.length)
      return
    }
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Lector de código de barras: tipea el código completo y manda Enter.
    const exacto = productos.find((p) => p.codigo_barras === query.trim() || p.plu_balanza === query.trim())
    if (exacto) {
      agregar(exacto)
    } else if (resultados[highlightIndex]) {
      agregar(resultados[highlightIndex])
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escaneá o buscá por nombre, código o PLU… (↑↓ para navegar, Enter para agregar)"
          className="w-full rounded-xl border border-border bg-surface-2 py-3 pl-10 pr-3 text-base text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {resultados.map((p, i) => (
            <button
              key={p.id}
              onClick={() => agregar(p)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left last:border-0 ${
                i === highlightIndex ? 'bg-surface-2' : 'hover:bg-surface-2'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-text">{p.nombre}</div>
                <div className="text-xs text-text-dim">
                  {p.codigo_barras || 'sin código'} · Stock: {p.stock}{p.venta_por_peso ? ` ${p.unidad_medida}` : ''}
                </div>
              </div>
              <div className="tabular-nums text-accent-2">
                {formatMoney(p.oferta_activa && p.precio_oferta ? p.precio_oferta : p.precio_venta)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
