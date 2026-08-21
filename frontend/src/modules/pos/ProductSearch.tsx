import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { tieneBolsa } from './precio'
import type { Producto } from '../productos/types'

interface Props {
  productos: Producto[]
  onAgregar: (producto: Producto, esBolsa: boolean) => void
}

export function ProductSearch({ productos, onAgregar }: Props) {
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.codigo_barras.includes(q))
      .slice(0, 8)
  }, [query, productos])

  useEffect(() => {
    setHighlightIndex(0)
  }, [resultados])

  function agregar(producto: Producto, esBolsa: boolean) {
    onAgregar(producto, esBolsa)
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
    // Lector de código de barras / Enter: siempre agrega en modo suelto —
    // vender la bolsa es una acción explícita del cajero (botón aparte).
    const exacto = productos.find((p) => p.codigo_barras === query.trim())
    if (exacto) {
      agregar(exacto, false)
    } else if (resultados[highlightIndex]) {
      agregar(resultados[highlightIndex], false)
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
          placeholder="Escaneá o buscá por nombre o código… (↑↓ para navegar, Enter para agregar)"
          className="w-full rounded-lg border border-border bg-surface-2 py-2.5 pl-10 pr-3 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {resultados.map((p, i) => {
            const conBolsa = tieneBolsa(p)
            return (
              <div
                key={p.id}
                // Con bolsa, la fila no agrega nada sola: sueltro y bolsa son
                // dos botones explícitos, para no sumar la opción equivocada
                // por un click a un costado del botón de bolsa.
                onClick={() => !conBolsa && agregar(p, false)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-0 ${
                  conBolsa ? '' : 'cursor-pointer'
                } ${i === highlightIndex ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text">{p.nombre}</div>
                  <div className="text-xs text-text-dim">
                    {p.codigo_barras || 'sin código'} · Stock: {p.stock}{p.venta_por_peso ? ` ${p.unidad_medida}` : ''}
                  </div>
                </div>

                {conBolsa ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); agregar(p, false) }}
                      className="rounded-lg border border-border px-2 py-1.5 text-xs tabular-nums text-text-dim hover:border-accent/50 hover:text-text"
                    >
                      Suelto · {formatMoney(p.precio_venta)}/{p.unidad_medida}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); agregar(p, true) }}
                      className="rounded-lg border border-accent/40 bg-accent/10 px-2 py-1.5 text-xs tabular-nums text-accent hover:bg-accent/20"
                    >
                      Bolsa {Number(p.bolsa_kg)}kg · {formatMoney(p.precio_bolsa!)}
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 tabular-nums text-accent-2">
                    {formatMoney(p.oferta_activa && p.precio_oferta ? p.precio_oferta : p.precio_venta)}
                    {p.venta_por_peso && <span className="text-xs text-text-dim">/{p.unidad_medida}</span>}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
