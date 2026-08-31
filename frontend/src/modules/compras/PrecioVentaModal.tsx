import { useState } from 'react'
import { AlertTriangle, ArrowRight, Loader2, TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { InputDecimal } from '../../components/ui/InputDecimal'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney, parseDecimal } from '../../lib/format'
import { margenDesdePrecio, precioDesdeMargen, redondearCentavos } from '../../lib/margen'
import { useUpdateProducto } from '../productos/api'
import { contenidoEnvase, etiquetaEnvase, presentacionDe } from '../productos/presentacion'
import type { Producto, ProductoInput } from '../productos/types'

/** Un producto que acaba de entrar por una compra, con el costo que se pagó
 * POR UNIDAD DE MEDIDA (kg, m, unidad) — que es como el sistema guarda el
 * costo y el stock.
 *
 * `producto` es como estaba ANTES de la compra: se capturó al elegirlo en el
 * formulario, así que todavía tiene los precios y el margen viejos, que es
 * justo con lo que hay que comparar. */
export interface LineaComprada {
  producto: Producto
  costoNuevo: number
}

/** Una forma de vender el producto. Un producto a granel tiene dos —el kilo
 * suelto y la bolsa cerrada— y cada una lleva su propio margen: el que compra
 * la bolsa entera paga menos por kilo, así que forzar el mismo margen en las
 * dos le rompería los precios al dueño. */
interface Presentacion {
  clave: 'suelto' | 'envase'
  etiqueta: string
  /** Costo de ESTA presentación: por unidad suelta, o por envase cerrado. */
  costo: number
  precioViejo: number
  margenTexto: string
  precioTexto: string
}

interface Fila {
  producto: Producto
  costoNuevo: number
  presentaciones: Presentacion[]
}

function armarFila({ producto, costoNuevo }: LineaComprada): Fila {
  const costoViejo = parseDecimal(producto.precio_costo)
  const envase = contenidoEnvase(producto)
  const unidad = producto.unidad_medida || 'unidad'

  /** El margen que el dueño ya venía usando en ESTA presentación es el mejor
   * valor por defecto: si el proveedor le aumentó, guardar sin tocar nada le
   * mantiene su ganancia de siempre sobre el costo nuevo. */
  function presentacion(
    clave: Presentacion['clave'], etiqueta: string, costo: number, precioViejo: number,
    margenDeRespaldo: number | null,
  ): Presentacion {
    const costoViejoPresentacion = clave === 'envase' && envase ? costoViejo * envase : costoViejo
    const margen = margenDesdePrecio(costoViejoPresentacion, precioViejo) ?? margenDeRespaldo
    if (margen === null) {
      // Sin margen previo ni de respaldo (producto nuevo, sin precio): se deja
      // el precio que tenga y que lo defina el dueño.
      return { clave, etiqueta, costo, precioViejo, margenTexto: '', precioTexto: precioViejo > 0 ? String(precioViejo) : '' }
    }
    const precio = precioDesdeMargen(costo, margen)
    return {
      clave, etiqueta, costo, precioViejo,
      margenTexto: String(Math.round(margen * 10) / 10),
      precioTexto: precio === null ? '' : String(redondearCentavos(precio)),
    }
  }

  const suelto = presentacion(
    'suelto',
    envase ? presentacionDe(unidad).suelto : 'Precio de venta',
    costoNuevo,
    parseDecimal(producto.precio_venta),
    null,
  )

  if (!envase) return { producto, costoNuevo, presentaciones: [suelto] }

  return {
    producto,
    costoNuevo,
    presentaciones: [
      suelto,
      presentacion(
        'envase',
        etiquetaEnvase(unidad, envase),
        costoNuevo * envase,
        parseDecimal(producto.precio_bolsa),
        // Todavía no se vendía por envase cerrado: se arranca del margen del
        // suelto, que el dueño baja si quiere premiar la bolsa entera.
        parseDecimal(suelto.margenTexto) || null,
      ),
    ],
  }
}

/** Segundo paso de una compra: a cuánto se vende lo que acaba de entrar.
 *
 * Existe porque el momento de ponerle precio es justo ahora, con el costo nuevo
 * a la vista: si no, la mercadería queda vendiéndose al precio viejo —a veces
 * por debajo de lo que se acaba de pagar— hasta que alguien se acuerda de
 * revisarlo. Y lo que más se pasaba de largo era el envase cerrado: se
 * actualizaba el kilo suelto y la bolsa de 20 kg quedaba al precio del mes
 * pasado. */
export function PrecioVentaModal({ lineas, onClose }: { lineas: LineaComprada[]; onClose: () => void }) {
  const { toast } = useToast()
  const updateProducto = useUpdateProducto()
  const [filas, setFilas] = useState<Fila[]>(() => lineas.map(armarFila))
  const [margenGlobal, setMargenGlobal] = useState('')
  const [guardando, setGuardando] = useState(false)

  /** Margen y precio de una presentación están atados: se toca uno y se
   * recalcula el otro. */
  function mapearPresentacion(
    filaIndex: number, clave: Presentacion['clave'], cambio: (p: Presentacion) => Presentacion,
  ) {
    setFilas((prev) => prev.map((fila, i) => (
      i !== filaIndex ? fila : {
        ...fila,
        presentaciones: fila.presentaciones.map((p) => (p.clave === clave ? cambio(p) : p)),
      }
    )))
  }

  function cambiarMargen(filaIndex: number, clave: Presentacion['clave'], valor: string) {
    mapearPresentacion(filaIndex, clave, (p) => {
      const precio = precioDesdeMargen(p.costo, parseDecimal(valor))
      return { ...p, margenTexto: valor, precioTexto: precio === null ? '' : String(redondearCentavos(precio)) }
    })
  }

  function cambiarPrecio(filaIndex: number, clave: Presentacion['clave'], valor: string) {
    mapearPresentacion(filaIndex, clave, (p) => {
      const margen = margenDesdePrecio(p.costo, parseDecimal(valor))
      return { ...p, precioTexto: valor, margenTexto: margen === null ? '' : String(Math.round(margen * 10) / 10) }
    })
  }

  /** Un margen para todo, las dos presentaciones incluidas. Es un atajo para
   * cuando el dueño trabaja con un margen parejo; el de cada renglón le gana
   * después si lo corrige a mano. */
  function aplicarATodos() {
    const margen = parseDecimal(margenGlobal)
    setFilas((prev) => prev.map((fila) => ({
      ...fila,
      presentaciones: fila.presentaciones.map((p) => {
        const precio = precioDesdeMargen(p.costo, margen)
        return { ...p, margenTexto: margenGlobal, precioTexto: precio === null ? '' : String(redondearCentavos(precio)) }
      }),
    })))
  }

  async function guardar() {
    // Un PATCH por producto con las dos presentaciones juntas, no uno por
    // precio: si la bolsa fallara sola quedaría un producto con el suelto nuevo
    // y el envase viejo, que es peor que no haber tocado nada.
    const cambios: { nombre: string; id: string; input: ProductoInput }[] = []
    for (const fila of filas) {
      const input: ProductoInput = {}
      for (const p of fila.presentaciones) {
        const precio = parseDecimal(p.precioTexto)
        if (precio <= 0 || precio === p.precioViejo) continue
        if (p.clave === 'suelto') input.precio_venta = String(redondearCentavos(precio))
        else input.precio_bolsa = String(redondearCentavos(precio))
      }
      if (Object.keys(input).length > 0) cambios.push({ nombre: fila.producto.nombre, id: fila.producto.id, input })
    }

    if (cambios.length === 0) {
      toast('No hay precios para cambiar')
      onClose()
      return
    }

    setGuardando(true)
    // ponytail: un PATCH por producto, en paralelo. Reusa el endpoint que ya
    // existe en vez de inventar uno masivo; con una factura de 15 renglones son
    // 15 requests que salen juntas. Si alguna compra trae cien productos, acá
    // va un endpoint que los actualice en una transacción.
    const resultados = await Promise.allSettled(
      cambios.map(({ id, input }) => updateProducto.mutateAsync({ id, input })),
    )
    setGuardando(false)

    const fallaron = resultados.filter((r) => r.status === 'rejected')
    if (fallaron.length === 0) {
      toast(`${cambios.length} producto${cambios.length === 1 ? '' : 's'} con precio nuevo`)
      onClose()
      return
    }
    // Se avisa cuántos entraron y cuántos no, y el modal QUEDA ABIERTO: cerrarlo
    // acá dejaría productos vendiéndose al precio viejo sin que nadie lo sepa.
    const motivo = extraerMensajeError((fallaron[0] as PromiseRejectedResult).reason, 'no se pudo guardar')
    toast(
      `Se actualizaron ${cambios.length - fallaron.length} de ${cambios.length}. ${fallaron.length} fallaron: ${motivo}`,
      'error',
    )
  }

  const hayEnvases = filas.some((f) => f.presentaciones.length > 1)

  return (
    <Modal title="¿A cuánto lo vendés?" onClose={onClose} ancho="xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-2xl text-sm text-text-dim">
            Compra registrada. El margen viene puesto con el que ya usabas en cada precio, así que
            guardar sin tocar nada mantiene tu ganancia sobre lo que acabás de pagar.
            {hayEnvases && (
              <> Los productos que se venden sueltos y por envase cerrado llevan{' '}
              <span className="text-text">los dos precios por separado</span>, cada uno con su margen.</>
            )}
          </p>
          <div className="flex items-end gap-2">
            <InputDecimal
              id="margen-global" label="Mismo margen para todo"
              placeholder="45" value={margenGlobal} onChange={setMargenGlobal}
              className="w-24 text-right tabular-nums"
            />
            <Button type="button" variant="secondary" onClick={aplicarATodos} disabled={!margenGlobal}>
              Aplicar a todos
            </Button>
          </div>
        </div>

        <div className="flex max-h-[52vh] flex-col gap-3 overflow-y-auto pr-1">
          {filas.map((fila, i) => {
            const unidad = fila.producto.unidad_medida || 'unidad'
            return (
              <div key={fila.producto.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-text">{fila.producto.nombre}</p>
                  <p className="text-xs text-text-dim">
                    Costo pagado <span className="tabular-nums text-text">{formatMoney(fila.costoNuevo)}</span>
                    <span>/{unidad}</span>
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {fila.presentaciones.map((p) => {
                    const precioNuevo = parseDecimal(p.precioTexto)
                    const aPerdida = precioNuevo > 0 && precioNuevo < p.costo
                    const variacion = p.precioViejo > 0 && precioNuevo > 0
                      ? ((precioNuevo - p.precioViejo) / p.precioViejo) * 100
                      : null
                    return (
                      <div
                        key={p.clave}
                        className={`grid grid-cols-[150px_130px_100px_150px_1fr] items-center gap-3 rounded-lg border px-2 py-1.5 ${
                          aPerdida ? 'border-danger/50 bg-danger/5' : 'border-transparent'
                        }`}
                      >
                        <span className="truncate text-sm text-text-dim">{p.etiqueta}</span>

                        <span className="text-right text-xs tabular-nums text-text-dim">
                          cuesta {formatMoney(p.costo)}
                        </span>

                        <InputDecimal
                          aria-label={`Margen de ${fila.producto.nombre} — ${p.etiqueta}`}
                          placeholder="—" value={p.margenTexto}
                          onChange={(valor) => cambiarMargen(i, p.clave, valor)}
                          className="!py-1.5 text-right tabular-nums"
                        />

                        <InputDecimal
                          aria-label={`Precio de ${fila.producto.nombre} — ${p.etiqueta}`}
                          placeholder="0" value={p.precioTexto}
                          onChange={(valor) => cambiarPrecio(i, p.clave, valor)}
                          className="!py-1.5 text-right text-base tabular-nums"
                        />

                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-dim">
                          {aPerdida && (
                            <span className="flex items-center gap-1 text-danger">
                              <AlertTriangle size={11} /> por debajo del costo
                            </span>
                          )}
                          {p.precioViejo > 0 ? (
                            <>
                              <span className="tabular-nums">{formatMoney(p.precioViejo)}</span>
                              <ArrowRight size={11} className="shrink-0" />
                              <span className="tabular-nums text-text">{formatMoney(precioNuevo)}</span>
                              {variacion !== null && Math.abs(variacion) >= 0.5 && (
                                <span className={`flex items-center gap-0.5 tabular-nums ${variacion > 0 ? 'text-accent-2' : 'text-warning'}`}>
                                  <TrendingUp size={10} className={variacion < 0 ? 'rotate-180' : ''} />
                                  {variacion > 0 ? '+' : ''}{variacion.toFixed(0)}%
                                </span>
                              )}
                            </>
                          ) : (
                            <span>todavía no tenía precio</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Margen % · Precio de venta</span>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Dejar los precios como están</Button>
            <Button type="button" onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 size={14} className="animate-spin" />}
              Guardar precios
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
