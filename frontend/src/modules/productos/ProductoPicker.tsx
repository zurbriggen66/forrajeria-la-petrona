import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { useProductoSearch } from './api'
import { formatCantidadStock } from './stock'
import type { Producto } from './types'

interface Props {
  // Sólo necesita el nombre para el chip de "ya elegido": acepta cualquier
  // objeto que lo tenga, no sólo un Producto completo de la búsqueda — así
  // sirve también para reabrir un ítem ya guardado que no trae el Producto
  // entero (ver PresupuestoFormModal en modo edición).
  producto: Pick<Producto, 'nombre'> | null
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
  const [marcado, setMarcado] = useState(0)
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

  // Vuelve al primero cada vez que cambian los resultados: si no, la marca
  // podía quedar apuntando a un índice que ya no existe.
  // Va acá arriba, antes de cualquier return: un hook salteado en un render
  // rompe el orden y React tira "rendered fewer hooks than expected".
  useEffect(() => setMarcado(0), [resultados])

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

  const lista = resultados ?? []

  function elegir(p: Producto) {
    onSelect(p)
    setQuery('')
    setDebounced('')
    setAbierto(false)
  }

  /** Teclado, para no tener que soltar el teclado y agarrar el mouse en cada
   * renglón de un pedido largo. Enter con un código de barras exacto elige ese
   * producto aunque no sea el marcado: el lector tipea y manda Enter solo. */
  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setAbierto(false)
      return
    }
    if (e.key === 'ArrowDown' && lista.length) {
      e.preventDefault()
      setMarcado((i) => (i + 1) % lista.length)
      return
    }
    if (e.key === 'ArrowUp' && lista.length) {
      e.preventDefault()
      setMarcado((i) => (i - 1 + lista.length) % lista.length)
      return
    }
    if (e.key !== 'Enter' || !lista.length) return
    // preventDefault: sin esto el Enter manda el formulario del pedido entero.
    e.preventDefault()
    const exacto = lista.find((p) => p.codigo_barras === query.trim())
    elegir(exacto ?? lista[marcado] ?? lista[0])
  }

  const mostrarDropdown = abierto && debounced.trim().length >= 1

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
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
            lista.map((p, i) => (
              <button
                key={p.id} type="button"
                onClick={() => elegir(p)}
                onMouseEnter={() => setMarcado(i)}
                className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-0 ${
                  i === marcado ? 'bg-surface-2' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text">{p.nombre}</span>
                  <span className="block text-xs text-text-dim">
                    {p.codigo_barras || 'sin código'} · stock {formatCantidadStock(p.stock, p)}
                  </span>
                </span>
                {/* El precio importa tanto como el nombre cuando se arma un
                    pedido: evita tener que abrir el producto para verlo. */}
                <span className="shrink-0 tabular-nums text-sm text-accent-2">
                  {formatMoney(p.precio_venta)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
