import { useState, type FormEvent } from 'react'
import { Loader2, Package, Plus, Trash2, Truck, UserPlus, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { MontoOPorcentaje } from '../../components/ui/MontoOPorcentaje'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney, parseDecimal, redondearCantidad } from '../../lib/format'
import { useCuentasPago } from '../caja/api'
import { useClientesSearch } from '../pos/api'
import { ClienteFormModal } from '../clientes/ClienteFormModal'
import { CUENTA_CORRIENTE } from '../pos/PaymentPanel'
import { precioProducto } from '../pos/precio'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useCreateReparto, useUpdateReparto } from './api'
import type { Reparto } from './types'

/** Una fila del reparto.
 *
 * Guarda los datos sueltos y no el `Producto` entero porque al EDITAR un
 * reparto ya cargado no hay Producto completo: el reparto guarda el id, y el
 * resto (nombre, precios, envase) lo manda el serializer en cada ítem. Con esta
 * forma, una fila recién elegida y una que ya estaba se tratan igual. */
interface Row {
  productoId: string | null
  nombre: string
  cantidad: string
  esBolsa: boolean
  precioSuelto: number
  /** null = este producto no se vende por envase cerrado. */
  precioBolsa: number | null
  bolsaKg: number | null
  unidad: string
  venta_por_peso: boolean
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function filaVacia(): Row {
  return {
    productoId: null, nombre: '', cantidad: '1', esBolsa: false,
    precioSuelto: 0, precioBolsa: null, bolsaKg: null, unidad: '', venta_por_peso: false,
  }
}

function filaDesdeProducto(producto: Producto): Row {
  return {
    productoId: producto.id,
    nombre: producto.nombre,
    cantidad: '1',
    esBolsa: false,
    precioSuelto: Number(precioProducto(producto, false)),
    precioBolsa: producto.precio_bolsa === null ? null : Number(producto.precio_bolsa),
    bolsaKg: producto.bolsa_kg === null ? null : Number(producto.bolsa_kg),
    unidad: producto.unidad_medida,
    venta_por_peso: producto.venta_por_peso,
  }
}

/** Una fila que ya estaba guardada en el reparto. */
function filaDesdeItem(item: Reparto['items'][number]): Row {
  return {
    productoId: item.producto,
    nombre: item.producto_nombre ?? '',
    cantidad: item.cantidad,
    esBolsa: item.es_bolsa,
    precioSuelto: Number(item.producto_precio_venta ?? item.precio_unitario),
    precioBolsa: item.producto_precio_bolsa === null || item.producto_precio_bolsa === undefined
      ? null
      : Number(item.producto_precio_bolsa),
    bolsaKg: item.bolsa_kg === null ? null : Number(item.bolsa_kg),
    unidad: item.unidad_medida ?? '',
    venta_por_peso: Boolean(item.bolsa_kg),
  }
}

function precioDeFila(row: Row): number {
  return row.esBolsa && row.precioBolsa !== null ? row.precioBolsa : row.precioSuelto
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
  const [creandoCliente, setCreandoCliente] = useState(false)
  // Un solo campo para las dos cosas, igual que en el POS: el valor es el id de
  // una cuenta, o el centinela de cuenta corriente, o vacío (todavía no se sabe).
  const [formaCobro, setFormaCobro] = useState(
    reparto?.a_cuenta_corriente ? CUENTA_CORRIENTE : (reparto?.cuenta_pago ?? ''),
  )
  const { data: cuentas } = useCuentasPago(true)
  const [items, setItems] = useState<Row[]>(
    reparto && reparto.items.length > 0 ? reparto.items.map(filaDesdeItem) : [filaVacia()],
  )
  // Un reparto ya facturado no se toca: cambiarle los productos dejaría la
  // venta (que ya descontó stock y entró a caja) diciendo otra cosa. Uno
  // cancelado tampoco. Antes se bloqueaba SIEMPRE que fuera edición, así que un
  // pedido pendiente había que borrarlo y cargarlo de nuevo para corregirlo.
  const cerrado = Boolean(reparto && (reparto.venta || reparto.estado === 'entregado' || reparto.estado === 'cancelado'))

  const { data: clientesEncontrados } = useClientesSearch(clienteId ? '' : clienteNombre)

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const subtotal = cerrado
    ? Number(reparto!.subtotal)
    : items.reduce(
        (acc, row) => acc + (row.productoId ? precioDeFila(row) * Number(row.cantidad || 0) : 0),
        0,
      )
  const total = Math.max(subtotal - Number(descuento || 0) + Number(costoEnvio || 0), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const itemsInput = cerrado
      ? reparto!.items.map((i) => ({ producto: i.producto!, cantidad: i.cantidad, es_bolsa: i.es_bolsa }))
      : items
          .filter((i): i is Row & { productoId: string } => i.productoId !== null)
          .map((i) => ({
            producto: i.productoId,
            // Vacío mientras se corrige es normal en el formulario; en el payload no.
            cantidad: redondearCantidad(parseDecimal(i.cantidad)),
            es_bolsa: i.esBolsa,
          }))

    if (itemsInput.length === 0) {
      toast('Agregá al menos un producto al reparto', 'error')
      return
    }
    // El servidor lo exige igual; acá se avisa antes de mandar y con el motivo.
    if (!clienteId) {
      toast('Elegí el cliente de la lista, o crealo con el botón de al lado.', 'error')
      return
    }

    const input = {
      cliente: clienteId,
      cliente_nombre: clienteNombre,
      telefono,
      destino,
      fecha,
      notas,
      cuenta_pago: formaCobro === CUENTA_CORRIENTE || !formaCobro ? null : formaCobro,
      a_cuenta_corriente: formaCobro === CUENTA_CORRIENTE,
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
    <Modal title={esEdicion ? 'Editar reparto' : 'Nuevo reparto'} onClose={onClose} ancho="xl">
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
              <>
              {/* Sin ficha no se puede fiar, ni ver el historial del cliente,
                  ni avisarle: por eso es obligatorio y hay atajo para crearlo. */}
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-warning">
                Elegilo de la lista
                <button
                  type="button" onClick={() => setCreandoCliente(true)}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <UserPlus size={12} /> o creá el cliente
                </button>
              </span>
              {clientesEncontrados && clientesEncontrados.length > 0 && (
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
              )}
              </>
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
            {!cerrado && (
              <Button type="button" variant="ghost" onClick={() => setItems((p) => [...p, filaVacia()])} className="!px-2 !py-1 text-xs">
                <Plus size={13} /> Agregar producto
              </Button>
            )}
          </div>

          {cerrado ? (
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
                {reparto?.venta
                  ? 'Este reparto ya está facturado: los productos no se tocan más, porque la venta ya descontó stock y entró a caja.'
                  : 'Los productos de un reparto entregado o cancelado no se cambian. Acá podés corregir la dirección, el envío, el descuento y los datos del cliente.'}
              </p>
            </div>
          ) : (
            // Scroll propio, como en el formulario de compra: con muchos
            // renglones el total y el botón de guardar tienen que seguir a la
            // vista sin recorrer toda la página.
            <div className="flex max-h-[42vh] flex-col gap-2 overflow-y-auto pr-1">
              {items.map((row, i) => {
                const conBolsa = row.precioBolsa !== null && row.bolsaKg !== null
                const precio = precioDeFila(row)
                return (
                  <div key={i} className="grid grid-cols-[1fr_190px_130px_150px_40px] items-center gap-3 rounded-lg border border-border/60 bg-surface-2/40 p-2">
                    {/* El picker sólo necesita el nombre para el chip de "ya
                        elegido", así que sirve igual para una fila guardada. */}
                    <ProductoPicker
                      producto={row.productoId ? { nombre: row.nombre } : null}
                      onSelect={(p) => setItems((prev) => prev.map((fila, idx) => (
                        idx === i ? (p ? filaDesdeProducto(p) : filaVacia()) : fila
                      )))}
                    />

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
                        {row.venta_por_peso ? `por ${row.unidad}` : ''}
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
                      className="rounded-md p-2 text-text-dim hover:bg-danger/10 hover:text-danger disabled:opacity-30"
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

        <section className="grid grid-cols-2 gap-4">
          <div>
            <Select
              id="forma-cobro" label="Cómo se cobra"
              value={formaCobro} onChange={(e) => setFormaCobro(e.target.value)}
            >
              <option value="">Se define al entregar</option>
              {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              {/* Sin cliente de la ficha no hay a quién cargarle la deuda: el
                  backend lo rechaza igual, pero acá se ve antes de guardar. */}
              <option value={CUENTA_CORRIENTE} disabled={!clienteId}>
                Cuenta corriente {clienteId ? '' : '(elegí un cliente de la lista)'}
              </option>
            </Select>
            {formaCobro === CUENTA_CORRIENTE && (
              <p className="mt-1 text-xs text-text-dim">
                El repartidor no cobra: la deuda va a la cuenta del cliente.
              </p>
            )}
          </div>
          <Input
            id="notas" label="Notas para el repartidor (opcional)" placeholder="Ej: tocar timbre del fondo"
            value={notas} onChange={(e) => setNotas(e.target.value)}
          />
        </section>

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

      {creandoCliente && (
        <ClienteFormModal
          cliente={null}
          onClose={() => setCreandoCliente(false)}
          onCreated={(creado) => {
            // Queda elegido de una: el que está cargando el reparto no tiene
            // que salir a buscarlo de nuevo en el buscador.
            setClienteId(creado.id)
            setClienteNombre(creado.nombre)
            if (!telefono) setTelefono(creado.celular || creado.telefono || '')
            setCreandoCliente(false)
          }}
        />
      )}
    </Modal>
  )
}
