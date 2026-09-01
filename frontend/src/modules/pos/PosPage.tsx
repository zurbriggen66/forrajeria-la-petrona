import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { CloudOff, Loader2, RefreshCcw } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { AbrirCajaForm } from '../caja/AbrirCajaForm'
import { useCajaActual } from '../caja/api'
import { crearVenta } from './api'
import { Cart } from './Cart'
import { PaymentPanel, type DatosCobro } from './PaymentPanel'
import { parseDecimal, redondearCantidad } from '../../lib/format'
import { cantidadInputId, claveLinea, subtotalLinea } from './precio'
import { PosStats } from './PosStats'
import { ProductSearch } from './ProductSearch'
import { QuickProducts } from './QuickProducts'
import { TicketModal, type TicketData } from './TicketModal'
import { VentasPendientesModal } from './VentasPendientesModal'
import { VentasPausadasModal } from './VentasPausadasModal'
import {
  guardarCarrito, leerCarrito, listarPausadas, pausarVenta, quitarPausada,
  type VentaPausada,
} from './ventasPausadas'
import { useCombos } from '../productos/api'
import { useCatalogoPOS } from './useCatalogoPOS'
import { useOfflineSync } from './useOfflineSync'
import type { CartItem, CartItemPack } from './types'
import type { Producto } from '../productos/types'

export function PosPage() {
  const { productos, loading: cargandoCatalogo, desdeCache } = useCatalogoPOS()
  // Sólo los activos: un pack apagado no se ofrece en el mostrador.
  const { data: packs } = useCombos(true)
  const { online, pendientes, rechazadas, sincronizando, sincronizar } = useOfflineSync()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // Sin conexión no podemos confirmar el estado de la caja: no bloqueamos el
  // POS (offline-first) y confiamos en que el backend valide al sincronizar.
  const { data: cajaActual, isLoading: cargandoCaja, isError: errorCaja } = useCajaActual()

  // El carrito arranca de lo guardado en el dispositivo: irse a mirar el stock
  // —o que se recargue la pestaña— ya no se lleva puesta la venta a medio cargar.
  const [cart, setCart] = useState<CartItem[]>(() => leerCarrito())
  const [pausadas, setPausadas] = useState<VentaPausada[]>(() => listarPausadas())
  const [verPausadas, setVerPausadas] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [ticket, setTicket] = useState<TicketData | null>(null)
  // Producto a granel recién agregado: en cuanto el carrito lo renderiza, le
  // pasamos el foco a su campo de peso — si no, queda cargado con "1" (kg
  // asumidos) y nada le avisa al cajero que tiene que pesarlo y corregirlo.
  const [enfocarPeso, setEnfocarPeso] = useState<string | null>(null)
  const [verPendientes, setVerPendientes] = useState(false)

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + subtotalLinea(item), 0),
    [cart],
  )

  useEffect(() => {
    guardarCarrito(cart)
  }, [cart])

  useEffect(() => {
    if (!enfocarPeso) return
    const input = document.getElementById(enfocarPeso) as HTMLInputElement | null
    input?.focus()
    input?.select()
    setEnfocarPeso(null)
  }, [enfocarPeso])

  function pausarActual() {
    if (cart.length === 0) return
    setPausadas(pausarVenta(cart))
    setCart([])
    toast('Venta pausada — la retomás desde el carrito')
  }

  /** Retomar no pisa lo que está cargado: si hay algo en el mostrador se pausa
   * solo, así el cajero puede ir y venir entre dos clientes sin perder nada. */
  function retomarVenta(venta: VentaPausada) {
    let listado = quitarPausada(venta.id)
    if (cart.length > 0) listado = pausarVenta(cart)
    setPausadas(listado)
    setCart(venta.items)
    setVerPausadas(false)
  }

  function descartarPausada(venta: VentaPausada) {
    setPausadas(quitarPausada(venta.id))
  }

  /** Suma uno a la línea que ya está, o la agrega. `paso` existe porque a
   * granel se suma de a 100 g y no de a un kilo. */
  function sumarOAgregar(nueva: CartItem, paso: number) {
    const clave = claveLinea(nueva)
    setCart((prev) => (
      prev.some((i) => claveLinea(i) === clave)
        ? prev.map((i) => (
          claveLinea(i) === clave
            ? { ...i, cantidad: redondearCantidad(parseDecimal(i.cantidad) + paso) }
            : i
        ))
        : [...prev, nueva]
    ))
  }

  function agregarProducto(producto: Producto, esBolsa: boolean) {
    sumarOAgregar(
      {
        tipo: 'producto',
        producto: producto as Extract<CartItem, { tipo: 'producto' }>['producto'],
        cantidad: '1',
        esBolsa,
        descuentoPct: '',
      },
      esBolsa ? 1 : producto.venta_por_peso ? 0.1 : 1,
    )
    if (producto.venta_por_peso && !esBolsa) {
      setEnfocarPeso(cantidadInputId(producto.id, esBolsa))
    }
  }

  /** Un pack entra como UNA línea a su propio precio. El stock de cada producto
   * que lo compone lo descuenta el servidor al cobrar
   * (ventas/views.py::_crear_venta): acá no se toca nada del catálogo. */
  function agregarPack(pack: CartItemPack['pack']) {
    sumarOAgregar({ tipo: 'pack', pack, cantidad: '1', descuentoPct: '' }, 1)
  }

  function cambiarCantidad(clave: string, cantidad: string) {
    // Sin guarda de "<=0 borra la línea": el stepper de +/- ya nunca baja de 1
    // (Math.max(1, …) en Cart), y en el campo de peso a granel un "0"
    // intermedio es normal mientras se tipea "0.350" — borrar la línea ahí
    // se comía el producto apenas el cajero empezaba a escribir el peso real.
    setCart((prev) => prev.map((i) => (claveLinea(i) === clave ? { ...i, cantidad } : i)))
  }

  function cambiarDescuento(clave: string, pct: string) {
    setCart((prev) => prev.map((i) => (claveLinea(i) === clave ? { ...i, descuentoPct: pct } : i)))
  }

  function quitarLinea(clave: string) {
    setCart((prev) => prev.filter((i) => claveLinea(i) !== clave))
  }

  async function handleCobrar(datos: DatosCobro) {
    if (cart.length === 0) return

    // Se avisa acá y nombrando el producto. El servidor rechaza igual una
    // cantidad en cero, pero su mensaje habla de "Fila 1" y de un mínimo de
    // 0.001: con el carrito lleno, el cajero no sabe cuál pesar de nuevo.
    const sinCantidad = cart.find((i) => parseDecimal(i.cantidad) <= 0)
    if (sinCantidad) {
      const nombre = sinCantidad.tipo === 'pack' ? sinCantidad.pack.nombre : sinCantidad.producto.nombre
      toast(`Poné cuánto lleva de "${nombre}" antes de cobrar.`, 'error')
      return
    }

    setCobrando(true)
    try {
      const total = Math.max(subtotal - parseDecimal(datos.descuento) + parseDecimal(datos.recargoMonto), 0)
      const resultado = await crearVenta({
        // Cada línea manda producto O pack, nunca los dos: el serializer lo
        // valida (ventas/serializers.py::VentaItemInputSerializer).
        items: cart.map((i) => (
          i.tipo === 'pack'
            ? { combo: i.pack.id, cantidad: i.cantidad, descuento_pct: i.descuentoPct || '0' }
            : {
              producto: i.producto.id,
              cantidad: i.cantidad,
              es_bolsa: i.esBolsa,
              descuento_pct: i.descuentoPct || '0',
            }
        )),
        cliente: datos.cliente?.id ?? null,
        cuenta_pago: datos.cuentaPagoId || null,
        pagos: datos.pagos.length > 0 ? datos.pagos : undefined,
        metodo_pago: datos.cuentaCorriente ? 'cuenta_corriente' : datos.cuentaPagoId ? '' : 'efectivo',
        monto_cuenta_corriente: datos.cuentaCorriente ? String(total) : undefined,
        efectivo_recibido: datos.cuentaCorriente ? null : datos.efectivoRecibido || null,
        vuelto_cuenta_pago: datos.vueltoCuentaPagoId || null,
        descuento: datos.descuento,
        recargo_monto: datos.recargoMonto,
      }, total)

      if (resultado.status === 'ok') {
        setTicket({ kind: 'ok', venta: resultado.venta })
        queryClient.invalidateQueries({ queryKey: ['estadisticas', 'resumen'] })
      } else {
        setTicket({ kind: 'queued', items: cart, total: subtotal - parseDecimal(datos.descuento) + parseDecimal(datos.recargoMonto) })
      }
      setCart([])
    } catch (err) {
      const mensaje = axios.isAxiosError(err)
        ? Object.values(err.response?.data ?? {}).flat().join(' ') || 'No se pudo registrar la venta.'
        : 'No se pudo registrar la venta.'
      toast(mensaje, 'error')
    } finally {
      setCobrando(false)
    }
  }

  if (cargandoCaja) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Verificando caja…
      </div>
    )
  }

  if (!errorCaja && cajaActual === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <AbrirCajaForm subtitle="No podés vender sin una caja abierta. Abrila para empezar a cobrar." />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {(!online || pendientes > 0 || rechazadas > 0) && (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          rechazadas > 0 ? 'border-danger/40 bg-danger/10 text-danger' : 'border-warning/30 bg-warning/10 text-warning'
        }`}>
          {sincronizando ? <Loader2 size={15} className="animate-spin" /> : online ? <RefreshCcw size={15} /> : <CloudOff size={15} />}
          {!online && 'Sin conexión — el POS sigue funcionando y se sincroniza al reconectar. '}
          {pendientes > 0 && `${pendientes} venta${pendientes === 1 ? '' : 's'} offline pendiente${pendientes === 1 ? '' : 's'} de sincronizar.`}
          {rechazadas > 0 && ` ${rechazadas} rechazada${rechazadas === 1 ? '' : 's'} esperando que la revises.`}
          {/* Clickeable: el contador solo no dice CUÁL venta ni de cuánto era. */}
          <button onClick={() => setVerPendientes(true)} className="ml-auto shrink-0 underline hover:no-underline">
            Ver detalle
          </button>
        </div>
      )}

      {desdeCache && !cargandoCatalogo && (
        <div className="rounded-lg border border-accent-2/30 bg-accent-2/5 px-3 py-2 text-xs text-text-dim">
          Mostrando el catálogo guardado localmente (sin conexión al servidor).
        </div>
      )}

      <PosStats />

      {/* En vertical (tablet) el cobro cae abajo del carrito: con el panel de
          320px fijos al costado, el carrito se quedaba con ~300px y su tabla
          scrolleaba horizontal para ver el subtotal. */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 lg:overflow-hidden">
          <ProductSearch productos={productos} onAgregar={agregarProducto} />
          <QuickProducts
            productos={productos}
            onAgregar={agregarProducto}
            packs={packs ?? []}
            onAgregarPack={agregarPack}
          />
          <Cart
            items={cart}
            onCambiarCantidad={cambiarCantidad}
            onCambiarDescuento={cambiarDescuento}
            onQuitar={quitarLinea}
            onVaciar={() => setCart([])}
            onPausar={pausarActual}
            pausadas={pausadas.length}
            onVerPausadas={() => setVerPausadas(true)}
          />
        </div>

        <PaymentPanel
          subtotal={subtotal}
          cobrando={cobrando}
          disabled={cart.length === 0}
          onCobrar={handleCobrar}
        />
      </div>

      {ticket && <TicketModal data={ticket} onNuevaVenta={() => setTicket(null)} />}

      {verPausadas && (
        <VentasPausadasModal
          ventas={pausadas}
          hayCarrito={cart.length > 0}
          onRetomar={retomarVenta}
          onDescartar={descartarPausada}
          onClose={() => setVerPausadas(false)}
        />
      )}

      {verPendientes && (
        <VentasPendientesModal
          onClose={() => setVerPendientes(false)}
          onSincronizar={sincronizar}
          sincronizando={sincronizando}
        />
      )}
    </div>
  )
}
