import { useState } from 'react'
import { AlertTriangle, Minus, Package, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { formatCantidadStock } from '../productos/stock'
import { cantidadInputId, kgEquivalente, precioUnitario, subtotalLinea } from './precio'
import type { CartItem } from './types'

interface Props {
  items: CartItem[]
  onCambiarCantidad: (productoId: string, esBolsa: boolean, cantidad: string) => void
  onCambiarDescuento: (productoId: string, esBolsa: boolean, pct: string) => void
  onQuitar: (productoId: string, esBolsa: boolean) => void
  onVaciar: () => void
}

/** Cantidad de un producto a granel: en kg, o "quiero $2000 de esto" — muy
 * habitual en el mostrador de una forrajería. `cantidad` en el carrito
 * siempre queda en kg; el monto es sólo una forma de cargarlo.
 *
 * El monto tipeado se guarda en un buffer local, NO se deriva de item.cantidad
 * en cada render: si se derivara, cada tecla redondeaba el kg resultante a 3
 * decimales y reescribía el campo con ese monto recalculado — tipear "2000"
 * dígito por dígito terminaba mostrando "1.95" porque el primer "2" ya
 * disparaba el round-trip. Con el buffer, se ve tal cual se tipea; el kg que
 * viaja al carrito sigue recalculándose en cada cambio igual que antes. */
function CantidadPorPeso({ item, onCambiarCantidad }: {
  item: CartItem
  onCambiarCantidad: Props['onCambiarCantidad']
}) {
  const [modo, setModo] = useState<'kg' | 'monto'>('kg')
  const [montoTexto, setMontoTexto] = useState('')
  const precio = precioUnitario(item)
  const unidad = item.producto.unidad_medida || 'kg'

  function activarModoMonto() {
    const monto = Number(item.cantidad) * precio
    setMontoTexto(monto > 0 ? String(Math.round(monto * 100) / 100) : '')
    setModo('monto')
  }

  function cambiarMonto(valor: string) {
    setMontoTexto(valor)
    const kg = precio > 0 ? (Number(valor) || 0) / precio : 0
    onCambiarCantidad(item.producto.id, item.esBolsa, kg.toFixed(3))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {/* step="any" y no "0.001": las flechitas suben de a 1 (que es como se
            cuentan bolsas, tornillos y metros) pero sigue aceptando decimales
            tipeados, como 2,5 kg. */}
        <input
          id={cantidadInputId(item.producto.id, item.esBolsa)}
          type="number" step="any" min="0"
          placeholder={modo === 'kg' ? '0.000' : '0'}
          onFocus={(e) => e.target.select()}
          value={modo === 'kg' ? item.cantidad : montoTexto}
          onChange={(e) => (
            modo === 'kg'
              ? onCambiarCantidad(item.producto.id, item.esBolsa, e.target.value)
              : cambiarMonto(e.target.value)
          )}
          className="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm tabular-nums focus:border-accent focus:outline-none"
        />
        <span className="text-xs text-text-dim">{modo === 'kg' ? unidad : '$'}</span>
      </div>
      <div className="flex gap-1">
        <button
          type="button" onClick={() => setModo('kg')}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
            modo === 'kg' ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
          }`}
        >
          {unidad}
        </button>
        <button
          type="button" onClick={activarModoMonto}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
            modo === 'monto' ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
          }`}
        >
          $
        </button>
      </div>
    </div>
  )
}

function superaStock(item: CartItem) {
  if (item.esBolsa) return kgEquivalente(item) >= Number(item.producto.stock)
  if (item.producto.venta_por_peso) return false
  return Number(item.cantidad) >= Number(item.producto.stock)
}

/** Stock disponible, en la misma unidad en la que el dueño lo piensa (kg o
 * bolsas — ver formatCantidadStock). Se muestra siempre, no sólo cuando ya
 * se pasó: el cajero tiene que verlo ANTES de tipear la cantidad, no
 * enterarse recién cuando ya cargó de más. */
function StockLinea({ item }: { item: CartItem }) {
  const agotado = Number(item.producto.stock) <= 0
  return (
    <span className={`flex items-center gap-1 ${
      superaStock(item) ? 'text-danger' : agotado ? 'text-warning' : 'text-text-dim'
    }`}>
      <Package size={10} className="shrink-0" />
      Stock: {formatCantidadStock(item.producto.stock, item.producto)}
    </span>
  )
}

export function Cart({ items, onCambiarCantidad, onCambiarDescuento, onQuitar, onVaciar }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-text-dim">
        <span className="rounded-full bg-surface-2 p-4">
          <ShoppingCart size={26} />
        </span>
        <div className="text-center">
          <p className="text-sm font-medium text-text">El carrito está vacío</p>
          <p className="mt-0.5 text-xs">Escaneá un código, buscá por nombre, o tocá un producto de la grilla.</p>
        </div>
      </div>
    )
  }

  const cantidadTotal = items.reduce((acc, i) => acc + Number(i.cantidad), 0)
  const subtotalTotal = items.reduce((acc, i) => acc + subtotalLinea(i), 0)

  const columns: Column<CartItem>[] = [
    {
      header: 'Producto',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <div>
            <div className="flex items-center gap-1.5 font-medium text-text">
              {item.producto.nombre}
              {item.esBolsa && <span className="font-normal text-text-dim"> (bolsa {Number(item.producto.bolsa_kg)}kg)</span>}
              {superaStock(item) && (
                <span title="Sin stock suficiente para esta cantidad">
                  <AlertTriangle size={13} className="shrink-0 text-danger" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-text-dim">{item.producto.codigo_barras || 'sin código'}</span>
              <span className="text-text-dim">·</span>
              <StockLinea item={item} />
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Cant.',
      render: (item) => {
        const cantidad = Number(item.cantidad)
        if (item.producto.venta_por_peso && !item.esBolsa) {
          return <CantidadPorPeso item={item} onCambiarCantidad={onCambiarCantidad} />
        }
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCambiarCantidad(item.producto.id, item.esBolsa, String(Math.max(1, cantidad - 1)))}
              className="rounded-lg p-1.5 text-text-dim hover:bg-surface-2 hover:text-text"
              aria-label={`Restar uno de ${item.producto.nombre}`}
            >
              <Minus size={15} />
            </button>
            {/* Tipeable y no un <span>: cargar 24 bolsas a botonazos es
                absurdo. El +/- queda para el caso de a uno, que es el común. */}
            <input
              id={cantidadInputId(item.producto.id, item.esBolsa)}
              type="number" step="1" min="1"
              aria-label={`Cantidad de ${item.producto.nombre}`}
              onFocus={(e) => e.target.select()}
              value={item.cantidad}
              onChange={(e) => onCambiarCantidad(item.producto.id, item.esBolsa, e.target.value)}
              className="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-center text-sm tabular-nums focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => onCambiarCantidad(item.producto.id, item.esBolsa, String(cantidad + 1))}
              className="rounded-lg p-1.5 text-text-dim hover:bg-surface-2 hover:text-text"
              aria-label={`Sumar uno de ${item.producto.nombre}`}
            >
              <Plus size={15} />
            </button>
            {item.esBolsa && <span className="text-xs text-text-dim">bolsa{cantidad === 1 ? '' : 's'}</span>}
          </div>
        )
      },
    },
    {
      header: 'Desc. %',
      render: (item) => (
        <input
          type="number" step="1" min="0" max="100" placeholder="0"
          aria-label={`Descuento en ${item.producto.nombre}`}
          onFocus={(e) => e.target.select()}
          value={item.descuentoPct}
          onChange={(e) => onCambiarDescuento(item.producto.id, item.esBolsa, e.target.value)}
          className="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm tabular-nums focus:border-accent focus:outline-none"
        />
      ),
    },
    {
      header: 'Precio',
      render: (item) => <span className="tabular-nums text-text-dim">{formatMoney(precioUnitario(item))}</span>,
    },
    {
      header: 'Subtotal',
      render: (item) => {
        const bruto = precioUnitario(item) * Number(item.cantidad)
        const neto = subtotalLinea(item)
        return (
          <div className="flex flex-col leading-tight">
            <span className="tabular-nums font-medium text-text">{formatMoney(neto)}</span>
            {neto !== bruto && (
              <span className="text-[11px] tabular-nums text-text-dim line-through">{formatMoney(bruto)}</span>
            )}
          </div>
        )
      },
    },
    {
      header: '',
      className: 'text-right',
      render: (item) => (
        <button onClick={() => onQuitar(item.producto.id, item.esBolsa)} className="rounded p-1 text-danger/70 hover:bg-danger/10 hover:text-danger">
          <X size={16} />
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-sm text-text-dim">
          <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
            <ShoppingCart size={12} />
            {items.length} línea{items.length === 1 ? '' : 's'}
          </span>
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
        <Table columns={columns} rows={items} rowKey={(item) => `${item.producto.id}:${item.esBolsa}`} />
      </div>
    </div>
  )
}
