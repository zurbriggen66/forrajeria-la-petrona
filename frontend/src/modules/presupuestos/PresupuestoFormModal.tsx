import { useState, type FormEvent } from 'react'
import { Loader2, Package, Plus, Trash2, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useClientesSearch } from '../pos/api'
import { precioProducto, tieneBolsa } from '../pos/precio'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useCreatePresupuesto, useUpdatePresupuesto } from './api'
import type { Presupuesto } from './types'

interface Row {
  producto: Producto | null
  cantidad: string
  esBolsa: boolean
}

function filaVacia(): Row {
  return { producto: null, cantidad: '1', esBolsa: false }
}

export function PresupuestoFormModal({ presupuesto, onClose }: { presupuesto?: Presupuesto; onClose: () => void }) {
  const { toast } = useToast()
  const crear = useCreatePresupuesto()
  const actualizar = useUpdatePresupuesto()
  const esEdicion = Boolean(presupuesto)

  const [clienteNombre, setClienteNombre] = useState(presupuesto?.cliente_nombre ?? '')
  const [clienteId, setClienteId] = useState<string | null>(presupuesto?.cliente ?? null)
  const [numero, setNumero] = useState(presupuesto?.numero ?? '')
  const [validez, setValidez] = useState(presupuesto?.validez ?? '')
  const [descuento, setDescuento] = useState(presupuesto?.descuento ?? '0')
  const [notas, setNotas] = useState(presupuesto?.notas ?? '')
  const [items, setItems] = useState<Row[]>([filaVacia()])

  const { data: clientesEncontrados } = useClientesSearch(clienteId ? '' : clienteNombre)

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  // En edición los productos ya cargados no se re-eligen (mismo criterio que
  // RepartoFormModal): se muestran como están y se reenvían tal cual.
  const subtotal = esEdicion
    ? Number(presupuesto!.subtotal)
    : items.reduce(
        (acc, row) => acc + (row.producto ? precioProducto(row.producto, row.esBolsa) * Number(row.cantidad || 0) : 0),
        0,
      )
  const total = Math.max(subtotal - Number(descuento || 0), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const itemsInput = esEdicion
      ? presupuesto!.items.map((i) => ({ producto: i.producto!, cantidad: i.cantidad, es_bolsa: i.es_bolsa }))
      : items
          .filter((i): i is Row & { producto: Producto } => i.producto !== null)
          .map((i) => ({ producto: i.producto.id, cantidad: i.cantidad, es_bolsa: i.esBolsa }))

    if (itemsInput.length === 0) {
      toast('Agregá al menos un producto al presupuesto', 'error')
      return
    }

    const input = {
      cliente: clienteId,
      cliente_nombre: clienteNombre,
      numero,
      notas,
      validez: validez || null,
      descuento: descuento || '0',
      items: itemsInput,
    }

    try {
      if (esEdicion && presupuesto) {
        await actualizar.mutateAsync({ id: presupuesto.id, input: { ...input, estado: presupuesto.estado } })
        toast('Presupuesto actualizado')
      } else {
        await crear.mutateAsync(input)
        toast('Presupuesto cargado')
      }
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el presupuesto'), 'error')
    }
  }

  const guardando = crear.isPending || actualizar.isPending

  return (
    <Modal title={esEdicion ? 'Editar presupuesto' : 'Nuevo presupuesto'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <section className="grid grid-cols-2 gap-4">
          <div className="relative">
            <Input
              id="cliente-nombre" label="Cliente" required placeholder="Nombre de quién recibe la cotización"
              value={clienteNombre}
              onChange={(e) => { setClienteNombre(e.target.value); setClienteId(null) }}
            />
            {clienteId ? (
              <span className="mt-1 flex items-center gap-1 text-xs text-accent-2">
                <UserRound size={12} /> Cliente registrado — el presupuesto queda en su ficha
              </span>
            ) : (
              clientesEncontrados && clientesEncontrados.length > 0 && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                  {clientesEncontrados.map((c) => (
                    <button
                      key={c.id} type="button"
                      onClick={() => { setClienteId(c.id); setClienteNombre(c.nombre) }}
                      className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-2"
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
          <Input
            id="numero" label="Número (opcional)" placeholder="Ej: P-0001"
            value={numero} onChange={(e) => setNumero(e.target.value)}
          />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Productos cotizados</span>
            {!esEdicion && (
              <Button type="button" variant="ghost" onClick={() => setItems((p) => [...p, filaVacia()])} className="!px-2 !py-1 text-xs">
                <Plus size={13} /> Agregar producto
              </Button>
            )}
          </div>

          {esEdicion ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2/50 p-3">
              {presupuesto!.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-text">
                    <Package size={13} className="text-text-dim" />
                    {item.cantidad}{item.es_bolsa ? ` bolsa${Number(item.cantidad) === 1 ? '' : 's'} de ${Number(item.bolsa_kg)}kg` : ` ${item.unidad_medida ?? ''}`}
                    {' · '}{item.producto_nombre}
                  </span>
                  <span className="tabular-nums text-text-dim">{formatMoney(item.subtotal)}</span>
                </div>
              ))}
              <p className="mt-1 border-t border-border pt-2 text-xs text-text-dim">
                Para cambiar los productos, cargá un presupuesto nuevo. Acá podés corregir el
                número, la validez, el descuento y los datos del cliente.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((row, i) => {
                const conBolsa = row.producto ? tieneBolsa(row.producto) : false
                const precio = row.producto ? precioProducto(row.producto, row.esBolsa) : 0
                return (
                  <div key={i} className="grid grid-cols-[1fr_150px_90px_110px_28px] items-center gap-2">
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

                    <Input
                      aria-label="Cantidad" type="number" min="0.001" step="0.001" value={row.cantidad}
                      onChange={(e) => updateItem(i, { cantidad: e.target.value })}
                    />
                    <span className="text-right text-sm tabular-nums text-text-dim">
                      {formatMoney(precio * Number(row.cantidad || 0))}
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
          )}
        </section>

        <section className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <Input
            id="validez" label="Válido hasta (opcional)" type="date"
            value={validez} onChange={(e) => setValidez(e.target.value)}
          />
          <Input
            id="descuento" label="Descuento" type="number" min="0" step="0.01"
            value={descuento} onChange={(e) => setDescuento(e.target.value)}
          />
        </section>

        <Input
          id="notas" label="Notas (opcional)" placeholder="Ej: precio válido sólo con pago en efectivo"
          value={notas} onChange={(e) => setNotas(e.target.value)}
        />

        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2/50 p-4">
          <div className="flex items-center justify-between text-sm text-text-dim">
            <span>Productos</span><span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          {Number(descuento) > 0 && (
            <div className="flex items-center justify-between text-sm text-danger">
              <span>Descuento</span><span className="tabular-nums">−{formatMoney(descuento)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-text">
            <span className="text-sm font-medium">Total del presupuesto</span>
            <span className="font-display text-xl font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={guardando}>
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {esEdicion ? 'Guardar cambios' : 'Cargar presupuesto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
