import { AlertTriangle, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import type { CartItem } from './types'

interface Props {
  items: CartItem[]
  onCambiarCantidad: (productoId: string, cantidad: string) => void
  onQuitar: (productoId: string) => void
  onVaciar: () => void
}

function precioUnitario(item: CartItem) {
  const p = item.producto
  return p.oferta_activa && p.precio_oferta ? Number(p.precio_oferta) : Number(p.precio_venta)
}

function superaStock(item: CartItem) {
  if (item.producto.venta_por_peso) return false
  return Number(item.cantidad) >= Number(item.producto.stock)
}

export function Cart({ items, onCambiarCantidad, onQuitar, onVaciar }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-text-dim">
        <ShoppingCart size={28} />
        <p className="text-sm">El carrito está vacío — buscá un producto para empezar.</p>
      </div>
    )
  }

  const cantidadTotal = items.reduce((acc, i) => acc + Number(i.cantidad), 0)
  const subtotalTotal = items.reduce((acc, i) => acc + precioUnitario(i) * Number(i.cantidad), 0)

  const columns: Column<CartItem>[] = [
    {
      header: 'Producto',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <div>
            <div className="font-medium text-text">{item.producto.nombre}</div>
            <div className="text-xs text-text-dim">{item.producto.codigo_barras || 'sin código'}</div>
          </div>
          {superaStock(item) && (
            <span title={`Sin stock suficiente (stock: ${item.producto.stock})`}>
              <AlertTriangle size={13} className="shrink-0 text-warning" />
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Cant.',
      render: (item) => {
        const cantidad = Number(item.cantidad)
        if (item.producto.venta_por_peso) {
          return (
            <input
              type="number" step="0.001" min="0.001" value={item.cantidad}
              onChange={(e) => onCambiarCantidad(item.producto.id, e.target.value)}
              className="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm tabular-nums focus:border-accent focus:outline-none"
            />
          )
        }
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCambiarCantidad(item.producto.id, String(Math.max(1, cantidad - 1)))}
              className="rounded-lg p-1.5 text-text-dim hover:bg-surface-2 hover:text-text"
            >
              <Minus size={15} />
            </button>
            <span className="w-7 text-center tabular-nums">{cantidad}</span>
            <button
              onClick={() => onCambiarCantidad(item.producto.id, String(cantidad + 1))}
              className="rounded-lg p-1.5 text-text-dim hover:bg-surface-2 hover:text-text"
            >
              <Plus size={15} />
            </button>
          </div>
        )
      },
    },
    {
      header: 'Precio',
      render: (item) => <span className="tabular-nums text-text-dim">{formatMoney(precioUnitario(item))}</span>,
    },
    {
      header: 'Subtotal',
      render: (item) => (
        <span className="tabular-nums font-medium text-text">
          {formatMoney(precioUnitario(item) * Number(item.cantidad))}
        </span>
      ),
    },
    {
      header: '',
      className: 'text-right',
      render: (item) => (
        <button onClick={() => onQuitar(item.producto.id)} className="rounded p-1 text-danger/70 hover:bg-danger/10 hover:text-danger">
          <X size={16} />
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm text-text-dim">
          <span className="font-medium text-text">{cantidadTotal % 1 === 0 ? cantidadTotal : cantidadTotal.toFixed(3)}</span> ítem{cantidadTotal === 1 ? '' : 's'}
          {' · '}
          <span className="tabular-nums font-medium text-text">{formatMoney(subtotalTotal)}</span>
        </span>
        <button
          onClick={onVaciar}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-dim hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={13} /> Vaciar carrito
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Table columns={columns} rows={items} rowKey={(item) => item.producto.id} />
      </div>
    </div>
  )
}
