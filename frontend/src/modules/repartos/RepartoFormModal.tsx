import { useState, type FormEvent } from 'react'
import { Loader2, Package, Plus, Trash2, Truck, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { MontoOPorcentaje } from '../../components/ui/MontoOPorcentaje'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useClientesSearch } from '../pos/api'
import { precioProducto, tieneBolsa } from '../pos/precio'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useCreateReparto, useUpdateReparto } from './api'
import type { Reparto } from './types'

interface Row {
  producto: Producto | null
  cantidad: string
  esBolsa: boolean
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function filaVacia(): Row {
  return { producto: null, cantidad: '1', esBolsa: false }
}

export function RepartoFormModal({ reparto, onClose }: { reparto?: Reparto; onClose: () => void }) {
  const { toast } = useToast()
  const crear = useCreateReparto()
  const actualizar = useUpdateReparto()
  const esEdicion = Boolean(reparto)

  const [clienteNombre, setClienteNombre] = useState(reparto?.cliente_nombre ?? '')
  const [clienteId, setClienteId] = useState<string | null>(reparto?.cliente ?? null)
  const [telefono, setTelefono] = useState(reparto?.telefono ?? '')
  const [destino, setDestino] = useState(reparto?.destino ?? '')
  const [fecha, setFecha] = useState(reparto?.fecha ?? hoyISO())
  const [costoEnvio, setCostoEnvio] = useState(reparto?.costo_envio ?? '0')
  const [descuento, setDescuento] = useState(reparto?.descuento ?? '0')
  const [notas, setNotas] = useState(reparto?.notas ?? '')
  const [items, setItems] = useState<Row[]>([filaVacia()])

  const { data: clientesEncontrados } = useClientesSearch(clienteId ? '' : clienteNombre)

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  // En edición los productos ya cargados no se re-eligen (el picker necesita el
  // Producto completo, y el reparto sólo guarda su id): se muestran como están
  // y se reenvían tal cual. Cambiar QUÉ se manda = cargar el reparto de nuevo.
  const subtotal = esEdicion
    ? Number(reparto!.subtotal)
    : items.reduce(
        (acc, row) => acc + (row.producto ? precioProducto(row.producto, row.esBolsa) * Number(row.cantidad || 0) : 0),
        0,
      )
  const total = Math.max(subtotal - Number(descuento || 0) + Number(costoEnvio || 0), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const itemsInput = esEdicion
      ? reparto!.items.map((i) => ({ producto: i.producto!, cantidad: i.cantidad, es_bolsa: i.es_bolsa }))
      : items
          .filter((i): i is Row & { producto: Producto } => i.producto !== null)
          .map((i) => ({ producto: i.producto.id, cantidad: i.cantidad, es_bolsa: i.esBolsa }))

    if (itemsInput.length === 0) {
      toast('Agregá al menos un producto al reparto', 'error')
      return
    }

    const input = {
      cliente: clienteId,
      cliente_nombre: clienteNombre,
      telefono,
      destino,
      fecha,
      notas,
      costo_envio: costoEnvio || '0',
      descuento: descuento || '0',
      items: itemsInput,
    }

    try {
      if (esEdicion && reparto) {
        await actualizar.mutateAsync({ id: reparto.id, input: { ...input, estado: reparto.estado } })
        toast('Reparto actualizado')
      } else {
        await crear.mutateAsync(input)
        toast('Reparto cargado')
      }
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el reparto'), 'error')
    }
  }

  const guardando = crear.isPending || actualizar.isPending

  return (
    <Modal title={esEdicion ? 'Editar reparto' : 'Nuevo reparto'} onClose={onClose} ancho="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <section className="grid grid-cols-2 gap-4">
          <div className="relative">
            <Input
              id="cliente-nombre" label="Cliente" required placeholder="Nombre de quién recibe"
              value={clienteNombre}
              onChange={(e) => { setClienteNombre(e.target.value); setClienteId(null) }}
            />
            {clienteId ? (
              <span className="mt-1 flex items-center gap-1 text-xs text-accent-2">
                <UserRound size={12} /> Cliente registrado — el reparto queda en su ficha
              </span>
            ) : (
              clientesEncontrados && clientesEncontrados.length > 0 && (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                  {clientesEncontrados.map((c) => (
                    <button
                      key={c.id} type="button"
                      onClick={() => {
                        setClienteId(c.id)
                        setClienteNombre(c.nombre)
                        if (!telefono) setTelefono(c.telefono ?? '')
                      }}
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
            id="telefono" label="Teléfono (opcional)" placeholder="Para avisar cuando sale"
            value={telefono} onChange={(e) => setTelefono(e.target.value)}
          />
        </section>

        <section className="grid grid-cols-[2fr_1fr] gap-4">
          <Input
            id="destino" label="Dirección de entrega" required placeholder="Calle, número, barrio / referencias"
            value={destino} onChange={(e) => setDestino(e.target.value)}
          />
          <Input
            id="fecha" label="Fecha de entrega" type="date" required
            value={fecha} onChange={(e) => setFecha(e.target.value)}
          />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Productos a repartir</span>
            {!esEdicion && (
              <Button type="button" variant="ghost" onClick={() => setItems((p) => [...p, filaVacia()])} className="!px-2 !py-1 text-xs">
                <Plus size={13} /> Agregar producto
              </Button>
            )}
          </div>

          {esEdicion ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2/50 p-3">
              {reparto!.items.map((item) => (
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
                Para cambiar los productos, cargá un reparto nuevo. Acá podés corregir la dirección,
                el envío, el descuento y los datos del cliente.
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
                      aria-label="Cantidad" type="number" min="0.001" step="any" value={row.cantidad}
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
            id="costo-envio" label="Costo de envío" type="number" min="0" step="0.01"
            value={costoEnvio} onChange={(e) => setCostoEnvio(e.target.value)}
          />
          <MontoOPorcentaje
            id="descuento" label="Descuento" base={subtotal}
            value={descuento} onChange={setDescuento}
          />
        </section>

        <Input
          id="notas" label="Notas para el repartidor (opcional)" placeholder="Ej: tocar timbre del fondo"
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
          {Number(costoEnvio) > 0 && (
            <div className="flex items-center justify-between text-sm text-accent-2">
              <span className="flex items-center gap-1.5"><Truck size={13} /> Envío</span>
              <span className="tabular-nums">+{formatMoney(costoEnvio)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-text">
            <span className="text-sm font-medium">Total del reparto</span>
            <span className="font-display text-xl font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={guardando}>
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {esEdicion ? 'Guardar cambios' : 'Cargar reparto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
