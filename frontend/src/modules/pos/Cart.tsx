import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import type { CartItem } from './types'

interface Props {
  items: CartItem[]
  onCambiarCantidad: (productoId: string, cantidad: string) => void
  onQuitar: (productoId: string) => void
}

function precioUnitario(item: CartItem) {
  const p = item.producto
  return p.oferta_activa && p.precio_oferta ? Number(p.precio_oferta) : Number(p.precio_venta)
}

export function Cart({ items, onCambiarCantidad, onQuitar }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-text-dim">
        <ShoppingCart size={28} />
        <p className="text-sm">El carrito está vacío — buscá un producto para empezar.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const cantidad = Number(item.cantidad)
          const subtotal = precioUnitario(item) * cantidad
          return (
            <div key={item.producto.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-text">{item.producto.nombre}</div>
                <div className="text-xs text-text-dim">{formatMoney(precioUnitario(item))} c/u</div>
              </div>

              {item.producto.venta_por_peso ? (
                <input
                  type="number" step="0.001" min="0.001" value={item.cantidad}
                  onChange={(e) => onCambiarCantidad(item.producto.id, e.target.value)}
                  className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm tabular-nums focus:border-accent focus:outline-none"
                />
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onCambiarCantidad(item.producto.id, String(Math.max(1, cantidad - 1)))}
                    className="rounded p-1 text-text-dim hover:bg-surface-2 hover:text-text"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">{cantidad}</span>
                  <button
                    onClick={() => onCambiarCantidad(item.producto.id, String(cantidad + 1))}
                    className="rounded p-1 text-text-dim hover:bg-surface-2 hover:text-text"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}

              <div className="w-24 text-right text-sm font-medium tabular-nums text-text">{formatMoney(subtotal)}</div>

              <button onClick={() => onQuitar(item.producto.id)} className="rounded p-1.5 text-text-dim hover:bg-danger/10 hover:text-danger">
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
