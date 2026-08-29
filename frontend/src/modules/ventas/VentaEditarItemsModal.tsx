import { useState, type FormEvent } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { InputDecimal } from '../../components/ui/InputDecimal'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney, parseDecimal } from '../../lib/format'
import { precioProducto, tieneBolsa } from '../pos/precio'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useEditarItemsVenta } from './api'
import type { Venta, VentaItem } from './types'

// Sólo los campos que hacen falta para el precio y el picker: un ítem ya
// vendido no trae el Producto completo, así que se reconstruye con lo que
// manda VentaItemSerializer (mismo criterio que PresupuestoFormModal).
type ProductoCotizable = Pick<
  Producto,
  'id' | 'nombre' | 'venta_por_peso' | 'unidad_medida' | 'bolsa_kg' | 'precio_bolsa' | 'precio_venta' | 'precio_oferta' | 'oferta_activa'
>

interface Row {
  producto: ProductoCotizable | null
  cantidad: string
  esBolsa: boolean
  descuentoPct: string
}

function filaVacia(): Row {
  return { producto: null, cantidad: '1', esBolsa: false, descuentoPct: '' }
}

/** ¿Esta línea se vendió por bolsa cerrada? VentaItem no guarda ese flag
 * (a diferencia de PresupuestoItem): se infiere comparando el peso real
 * descontado contra cantidad × bolsa_kg. */
function esBolsaHeuristico(item: VentaItem): boolean {
  const cantidad = Number(item.cantidad)
  if (item.peso_kg === null || !item.bolsa_kg || cantidad === 0) return false
  const bolsasEquivalentes = Number(item.peso_kg) / cantidad
  return Math.abs(bolsasEquivalentes - Number(item.bolsa_kg)) < 0.001
}

function filaDesdeItem(item: VentaItem): Row {
  return {
    producto: item.producto ? {
      id: item.producto,
      nombre: item.producto_nombre ?? 'Producto',
      venta_por_peso: item.venta_por_peso,
      unidad_medida: item.unidad_medida ?? '',
      bolsa_kg: item.bolsa_kg,
      precio_bolsa: item.precio_bolsa,
      precio_venta: item.precio_venta ?? '0',
      precio_oferta: item.precio_oferta,
      oferta_activa: item.oferta_activa,
    } : null,
    cantidad: item.cantidad,
    esBolsa: esBolsaHeuristico(item),
    descuentoPct: Number(item.descuento_pct) > 0 ? item.descuento_pct : '',
  }
}

/** Corregir los productos de una venta fiada ya cobrada: el dueño se olvidó
 * de cargar algo, o el cliente se llevó de más/de menos. Sólo aplica a lo
 * que quedó en cuenta corriente — la plata que ya entró a la caja ese día no
 * se retoca (ver VentaViewSet.editar_items). */
export function VentaEditarItemsModal({ venta, onClose }: { venta: Venta; onClose: () => void }) {
  const { toast } = useToast()
  const editar = useEditarItemsVenta()
  const [items, setItems] = useState<Row[]>(() =>
    venta.items.length > 0 ? venta.items.map(filaDesdeItem) : [filaVacia()],
  )

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function subtotalLinea(row: Row) {
    if (!row.producto) return 0
    const pct = Math.min(Math.max(parseDecimal(row.descuentoPct), 0), 100)
    return precioProducto(row.producto, row.esBolsa) * parseDecimal(row.cantidad) * (1 - pct / 100)
  }

  const nuevoTotal = Math.max(
    items.reduce((acc, row) => acc + subtotalLinea(row), 0) - Number(venta.descuento) + Number(venta.recargo_monto),
    0,
  )
  const delta = nuevoTotal - Number(venta.total)
  const nuevaCuentaCorriente = Number(venta.monto_cuenta_corriente) + delta

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const itemsInput = items
      .filter((i): i is Row & { producto: ProductoCotizable } => i.producto !== null)
      .map((i) => ({
        producto: i.producto.id,
        cantidad: i.cantidad,
        es_bolsa: i.esBolsa,
        descuento_pct: i.descuentoPct || '0',
      }))

    if (itemsInput.length === 0) {
      toast('Agregá al menos un producto', 'error')
      return
    }

    try {
      await editar.mutateAsync({ id: venta.id, items: itemsInput })
      toast('Venta corregida')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo corregir la venta'), 'error')
    }
  }

  return (
    <Modal title={`Corregir venta #${venta.numero_ticket ?? '—'}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="text-xs text-text-dim">
          Lo ya cobrado en efectivo, tarjeta o transferencia no se toca: la diferencia se suma o
          resta de la cuenta corriente de {venta.cliente_nombre}. Los precios se recalculan a los
          vigentes hoy, no a los del día de la venta.
        </p>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Productos</span>
            <Button type="button" variant="ghost" onClick={() => setItems((p) => [...p, filaVacia()])} className="!px-2 !py-1 text-xs">
              <Plus size={13} /> Agregar producto
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {items.map((row, i) => {
              const conBolsa = row.producto ? tieneBolsa(row.producto) : false
              return (
                <div key={i} className="grid grid-cols-[1fr_120px_90px_70px_110px_28px] items-center gap-2">
                  <ProductoPicker producto={row.producto} onSelect={(p) => updateItem(i, { producto: p, esBolsa: false })} />

                  {conBolsa ? (
                    <div className="flex gap-1">
                      <button
                        type="button" onClick={() => updateItem(i, { esBolsa: false })}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          !row.esBolsa ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
                        }`}
                      >
                        Suelto
                      </button>
                      <button
                        type="button" onClick={() => updateItem(i, { esBolsa: true })}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          row.esBolsa ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
                        }`}
                      >
                        Bolsa
                      </button>
                    </div>
                  ) : (
                    <span className="text-center text-xs text-text-dim">
                      {row.producto?.venta_por_peso ? `por ${row.producto.unidad_medida}` : ''}
                    </span>
                  )}

                  <InputDecimal
                    aria-label="Cantidad" value={row.cantidad}
                    onChange={(valor) => updateItem(i, { cantidad: valor })}
                  />
                  <InputDecimal
                    aria-label="Descuento %" placeholder="0%"
                    value={row.descuentoPct}
                    onChange={(valor) => updateItem(i, { descuentoPct: valor })}
                  />
                  <span className="text-right text-sm tabular-nums text-text-dim">
                    {formatMoney(subtotalLinea(row))}
                  </span>
                  <button
                    type="button" onClick={() => setItems((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)))}
                    disabled={items.length === 1}
                    className="rounded p-2 text-text-dim hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2/50 p-4">
          <div className="flex items-center justify-between text-sm text-text-dim">
            <span>Total anterior</span><span className="tabular-nums">{formatMoney(venta.total)}</span>
          </div>
          <div className="flex items-center justify-between text-text">
            <span className="text-sm font-medium">Total nuevo</span>
            <span className="font-display text-xl font-semibold tabular-nums">{formatMoney(nuevoTotal)}</span>
          </div>
          {delta !== 0 && (
            <div className={`mt-1 flex items-center justify-between border-t border-border pt-2 text-sm ${delta > 0 ? 'text-danger' : 'text-accent-2'}`}>
              <span>{delta > 0 ? 'Se suma a la deuda' : 'Se resta de la deuda'}</span>
              <span className="tabular-nums">{delta > 0 ? '+' : '−'}{formatMoney(Math.abs(delta))}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-text-dim">
            <span>Cuenta corriente resultante</span>
            <span className={`tabular-nums ${nuevaCuentaCorriente < 0 ? 'text-danger' : ''}`}>
              {formatMoney(Math.max(nuevaCuentaCorriente, 0))}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={editar.isPending || nuevaCuentaCorriente < 0}>
            {editar.isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar corrección
          </Button>
        </div>
      </form>
    </Modal>
  )
}
