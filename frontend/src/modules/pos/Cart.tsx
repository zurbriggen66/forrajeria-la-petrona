import { useState } from 'react'
import { AlertTriangle, Layers, Minus, Package, PauseCircle, Play, Plus, ShoppingCart, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { InputDecimal } from '../../components/ui/InputDecimal'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney, parseDecimal, redondearCantidad } from '../../lib/format'
import { formatCantidadStock } from '../productos/stock'
import { cantidadInputId, claveLinea, kgEquivalente, precioUnitario, subtotalLinea } from './precio'
import type { CartItem, CartItemProducto } from './types'

interface Props {
  items: CartItem[]
  /** Las tres reciben la clave de la línea (ver precio.ts::claveLinea) y no
   * (productoId, esBolsa): con packs en el carrito el par ya no alcanza para
   * identificar un renglón, y una sola clave sirve para las dos clases. */
  onCambiarCantidad: (clave: string, cantidad: string) => void
  onCambiarDescuento: (clave: string, pct: string) => void
  onQuitar: (clave: string) => void
  onVaciar: () => void
  onPausar: () => void
  /** Cuántas ventas quedaron a medio cargar (ventasPausadas.ts). */
  pausadas: number
  onVerPausadas: () => void
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
  item: CartItemProducto
  onCambiarCantidad: Props['onCambiarCantidad']
}) {
  const [modo, setModo] = useState<'kg' | 'monto'>('kg')
  const [montoTexto, setMontoTexto] = useState('')
  const precio = precioUnitario(item)
  const unidad = item.producto.unidad_medida || 'kg'
  const clave = claveLinea(item)

  function activarModoMonto() {
    const monto = parseDecimal(item.cantidad) * precio
    setMontoTexto(monto > 0 ? String(Math.round(monto * 100) / 100) : '')
    setModo('monto')
  }

  function cambiarMonto(valor: string) {
    setMontoTexto(valor)
    const kg = precio > 0 ? parseDecimal(valor) / precio : 0
    onCambiarCantidad(clave, redondearCantidad(kg))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {/* InputDecimal y no type="number": acá se pesa y se tipea "2,5", y
            un input numérico con coma queda inválido — la cantidad se caía a
            0 con el "2,5" todavía a la vista (ver parseDecimal en format.ts). */}
        <InputDecimal
          id={cantidadInputId(item.producto.id, item.esBolsa)}
          aria-label={modo === 'kg' ? `Cantidad de ${item.producto.nombre}` : `Monto de ${item.producto.nombre}`}
          placeholder={modo === 'kg' ? '0,000' : '0'}
          value={modo === 'kg' ? item.cantidad : montoTexto}
          onChange={(valor) => (modo === 'kg' ? onCambiarCantidad(clave, valor) : cambiarMonto(valor))}
          className="w-20 !px-2 !py-2 text-right tabular-nums"
        />
        <span className="text-xs text-text-dim">{modo === 'kg' ? unidad : '$'}</span>
      </div>
      <div className="flex gap-1">
        <button
          type="button" onClick={() => setModo('kg')}
          className={`min-h-9 flex-1 rounded-lg px-2 text-xs font-medium transition-colors ${
            modo === 'kg' ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
          }`}
        >
          {unidad}
        </button>
        <button
          type="button" onClick={activarModoMonto}
          className={`min-h-9 flex-1 rounded-lg px-2 text-xs font-medium transition-colors ${
            modo === 'monto' ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
          }`}
        >
          $
        </button>
      </div>
    </div>
  )
}

/** ¿Esta línea pide más de lo que hay?
 *
 * Para un pack se mide contra `armables`, que es el mínimo entre sus
 * componentes. El número se calculó cuando se trajeron los packs, así que
 * después de vender queda viejo hasta el próximo refetch: es un aviso, no un
 * bloqueo — el que valida de verdad es el servidor al cobrar. */
function superaStock(item: CartItem) {
  if (item.tipo === 'pack') return parseDecimal(item.cantidad) > item.pack.armables
  if (item.esBolsa) return kgEquivalente(item) >= Number(item.producto.stock)
  if (item.producto.venta_por_peso) return false
  return Number(item.cantidad) >= Number(item.producto.stock)
}

/** Stock disponible, en la misma unidad en la que el dueño lo piensa (kg o
 * bolsas — ver formatCantidadStock). Se muestra siempre, no sólo cuando ya
 * se pasó: el cajero tiene que verlo ANTES de tipear la cantidad, no
 * enterarse recién cuando ya cargó de más. */
function StockLinea({ item }: { item: CartItemProducto }) {
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

export function Cart({
  items, onCambiarCantidad, onCambiarDescuento, onQuitar, onVaciar,
  onPausar, pausadas, onVerPausadas,
}: Props) {
  const [confirmarVaciar, setConfirmarVaciar] = useState(false)

  // El acceso a las pausadas va acá y no en una fila aparte de la pantalla:
  // sumar otra barra le come al carrito el alto que justamente le falta.
  const chipPausadas = pausadas > 0 && (
    <button
      onClick={onVerPausadas}
      className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/20"
    >
      <PauseCircle size={13} />
      {pausadas} pausada{pausadas === 1 ? '' : 's'}
    </button>
  )

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-text-dim">
        <span className="rounded-full bg-surface-2 p-4">
          <ShoppingCart size={26} />
        </span>
        <div className="text-center">
          <p className="text-sm font-medium text-text">El carrito está vacío</p>
          <p className="mt-0.5 text-xs">Escaneá un código, buscá por nombre, o tocá un producto o pack de la grilla.</p>
        </div>
        {/* Carrito vacío es justo cuando querés retomar la que dejaste a
            medias: si el acceso viviera sólo en la barra del carrito cargado,
            acá no habría forma de volver a ella. */}
        {pausadas > 0 && (
          <button
            onClick={onVerPausadas}
            className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-warning hover:bg-warning/20"
          >
            <Play size={14} />
            Retomar venta pausada ({pausadas})
          </button>
        )}
      </div>
    )
  }

  const cantidadTotal = items.reduce((acc, i) => acc + Number(i.cantidad), 0)
  const subtotalTotal = items.reduce((acc, i) => acc + subtotalLinea(i), 0)

  const columns: Column<CartItem>[] = [
    {
      header: 'Producto',
      render: (item) => {
        const aviso = superaStock(item) && (
          <span title="Sin stock suficiente para esta cantidad">
            <AlertTriangle size={13} className="shrink-0 text-danger" />
          </span>
        )
        if (item.tipo === 'pack') {
          return (
            <div>
              <div className="flex items-center gap-1.5 font-medium text-text">
                <Layers size={13} className="shrink-0 text-accent" />
                {item.pack.nombre}
                <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-medium uppercase tracking-wide text-accent">pack</span>
                {aviso}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
                <span className="truncate">{item.pack.detalle}</span>
                <span>·</span>
                <span className={superaStock(item) ? 'text-danger' : ''}>
                  alcanza para {item.pack.armables}
                </span>
              </div>
            </div>
          )
        }
        return (
          <div>
            <div className="flex items-center gap-1.5 font-medium text-text">
              {item.producto.nombre}
              {item.esBolsa && <span className="font-normal text-text-dim"> (bolsa {Number(item.producto.bolsa_kg)}kg)</span>}
              {aviso}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-text-dim">{item.producto.codigo_barras || 'sin código'}</span>
              <span className="text-text-dim">·</span>
              <StockLinea item={item} />
            </div>
          </div>
        )
      },
    },
    {
      header: 'Cant.',
      render: (item) => {
        const cantidad = parseDecimal(item.cantidad)
        const clave = claveLinea(item)
        if (item.tipo === 'producto' && item.producto.venta_por_peso && !item.esBolsa) {
          return <CantidadPorPeso item={item} onCambiarCantidad={onCambiarCantidad} />
        }
        const nombre = item.tipo === 'pack' ? item.pack.nombre : item.producto.nombre
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCambiarCantidad(clave, redondearCantidad(Math.max(1, cantidad - 1)))}
              className="rounded-lg p-2.5 text-text-dim hover:bg-surface-2 hover:text-text"
              aria-label={`Restar uno de ${nombre}`}
            >
              <Minus size={15} />
            </button>
            {/* Tipeable y no un <span>: cargar 24 bolsas a botonazos es
                absurdo. El +/- queda para el caso de a uno, que es el común. */}
            <InputDecimal
              id={item.tipo === 'producto' ? cantidadInputId(item.producto.id, item.esBolsa) : undefined}
              aria-label={`Cantidad de ${nombre}`}
              value={item.cantidad}
              onChange={(valor) => onCambiarCantidad(clave, valor)}
              className="w-14 !px-2 !py-2 text-center tabular-nums"
            />
            <button
              onClick={() => onCambiarCantidad(clave, redondearCantidad(cantidad + 1))}
              className="rounded-lg p-2.5 text-text-dim hover:bg-surface-2 hover:text-text"
              aria-label={`Sumar uno de ${nombre}`}
            >
              <Plus size={15} />
            </button>
            {item.tipo === 'producto' && item.esBolsa && (
              <span className="text-xs text-text-dim">bolsa{cantidad === 1 ? '' : 's'}</span>
            )}
            {item.tipo === 'pack' && (
              <span className="text-xs text-text-dim">pack{cantidad === 1 ? '' : 's'}</span>
            )}
          </div>
        )
      },
    },
    {
      header: 'Desc. %',
      render: (item) => (
        <InputDecimal
          placeholder="0"
          aria-label={`Descuento en ${item.tipo === 'pack' ? item.pack.nombre : item.producto.nombre}`}
          value={item.descuentoPct}
          onChange={(valor) => onCambiarDescuento(claveLinea(item), valor)}
          className="w-14 !px-2 !py-2 text-right tabular-nums"
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
        const bruto = precioUnitario(item) * parseDecimal(item.cantidad)
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
        <button onClick={() => onQuitar(claveLinea(item))} className="rounded-md p-1 text-danger/70 hover:bg-danger/10 hover:text-danger">
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
        <div className="flex items-center gap-2">
          {chipPausadas}
          <button
            onClick={onPausar}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-dim hover:bg-warning/10 hover:text-warning"
          >
            <PauseCircle size={13} /> Pausar venta
          </button>
          <button
            onClick={() => setConfirmarVaciar(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-dim hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={13} /> Vaciar carrito
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Table columns={columns} rows={items} rowKey={claveLinea} />
      </div>

      {confirmarVaciar && (
        <ConfirmDialog
          titulo="Vaciar carrito"
          descripcion={`Se van a quitar ${items.length} línea${items.length === 1 ? '' : 's'} por ${formatMoney(subtotalTotal)}. Hay que volver a cargar todo.`}
          confirmarTexto="Vaciar" peligro
          onConfirmar={() => { onVaciar(); setConfirmarVaciar(false) }}
          onCancelar={() => setConfirmarVaciar(false)}
        />
      )}
    </div>
  )
}
