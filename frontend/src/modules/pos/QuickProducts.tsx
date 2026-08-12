import { useMemo } from 'react'
import { Star } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import type { Producto } from '../productos/types'

interface Props {
  productos: Producto[]
  onAgregar: (producto: Producto) => void
}

const MAX_DESTACADOS = 12

/** Grilla de un clic para lo que más se vende — sin esto, cada venta obliga a
 * tipear en el buscador aunque sea siempre el mismo puñado de productos. Se
 * arma sola a partir de `Producto.destacado`; si el comercio nunca marcó
 * ninguno, no ocupa lugar en la pantalla. */
export function QuickProducts({ productos, onAgregar }: Props) {
  const destacados = useMemo(
    () => productos.filter((p) => p.destacado).slice(0, MAX_DESTACADOS),
    [productos],
  )

  if (destacados.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {destacados.map((p) => (
        <button
          key={p.id}
          onClick={() => onAgregar(p)}
          className="flex flex-col items-start gap-1 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-accent/50 hover:bg-surface-2"
        >
          <Star size={13} className="text-accent" />
          <span className="line-clamp-2 text-sm font-medium leading-tight text-text">{p.nombre}</span>
          <span className="tabular-nums text-sm text-accent-2">
            {formatMoney(p.oferta_activa && p.precio_oferta ? p.precio_oferta : p.precio_venta)}
          </span>
        </button>
      ))}
    </div>
  )
}
