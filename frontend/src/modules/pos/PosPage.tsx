import { useMemo, useState } from 'react'
import axios from 'axios'
import { CloudOff, Loader2, RefreshCcw } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { AbrirCajaForm } from '../caja/AbrirCajaForm'
import { useCajaActual } from '../caja/api'
import { crearVenta } from './api'
import { Cart } from './Cart'
import { PaymentPanel, type DatosCobro } from './PaymentPanel'
import { ProductSearch } from './ProductSearch'
import { TicketModal, type TicketData } from './TicketModal'
import { useCatalogoPOS } from './useCatalogoPOS'
import { useOfflineSync } from './useOfflineSync'
import type { CartItem } from './types'
import type { Producto } from '../productos/types'

export function PosPage() {
  const { productos, loading: cargandoCatalogo, desdeCache } = useCatalogoPOS()
  const { online, pendientes, sincronizando } = useOfflineSync()
  const { toast } = useToast()
  // Sin conexión no podemos confirmar el estado de la caja: no bloqueamos el
  // POS (offline-first) y confiamos en que el backend valide al sincronizar.
  const { data: cajaActual, isLoading: cargandoCaja, isError: errorCaja } = useCajaActual()

  const [cart, setCart] = useState<CartItem[]>([])
  const [cobrando, setCobrando] = useState(false)
  const [ticket, setTicket] = useState<TicketData | null>(null)

  const subtotal = useMemo(
    () =>
      cart.reduce((acc, item) => {
        const precio = item.producto.oferta_activa && item.producto.precio_oferta
          ? Number(item.producto.precio_oferta)
          : Number(item.producto.precio_venta)
        return acc + precio * Number(item.cantidad)
      }, 0),
    [cart],
  )

  function agregarProducto(producto: Producto) {
    setCart((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id)
      if (existente) {
        const paso = producto.venta_por_peso ? 0.1 : 1
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: String(Number(i.cantidad) + paso) } : i,
        )
      }
      return [...prev, { producto: producto as CartItem['producto'], cantidad: producto.venta_por_peso ? '1' : '1' }]
    })
  }

  function cambiarCantidad(productoId: string, cantidad: string) {
    if (Number(cantidad) <= 0) {
      quitarProducto(productoId)
      return
    }
    setCart((prev) => prev.map((i) => (i.producto.id === productoId ? { ...i, cantidad } : i)))
  }

  function quitarProducto(productoId: string) {
    setCart((prev) => prev.filter((i) => i.producto.id !== productoId))
  }

  async function handleCobrar(datos: DatosCobro) {
    if (cart.length === 0) return
    setCobrando(true)
    try {
      const total = Math.max(subtotal - Number(datos.descuento || 0) + Number(datos.recargoMonto || 0), 0)
      const resultado = await crearVenta({
        items: cart.map((i) => ({ producto: i.producto.id, cantidad: i.cantidad })),
        cliente: datos.cliente?.id ?? null,
        cuenta_pago: datos.cuentaPagoId || null,
        metodo_pago: datos.cuentaCorriente ? 'cuenta_corriente' : datos.cuentaPagoId ? '' : 'efectivo',
        monto_efectivo: datos.cuentaCorriente ? undefined : datos.efectivoRecibido || undefined,
        monto_cuenta_corriente: datos.cuentaCorriente ? String(total) : undefined,
        efectivo_recibido: datos.cuentaCorriente ? null : datos.efectivoRecibido || null,
        descuento: datos.descuento,
        recargo_monto: datos.recargoMonto,
      })

      if (resultado.status === 'ok') {
        setTicket({ kind: 'ok', venta: resultado.venta })
      } else {
        setTicket({ kind: 'queued', items: cart, total: subtotal - Number(datos.descuento || 0) + Number(datos.recargoMonto || 0) })
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
      {(!online || pendientes > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {sincronizando ? <Loader2 size={15} className="animate-spin" /> : online ? <RefreshCcw size={15} /> : <CloudOff size={15} />}
          {!online && 'Sin conexión — el POS sigue funcionando y se sincroniza al reconectar. '}
          {pendientes > 0 && `${pendientes} venta${pendientes === 1 ? '' : 's'} offline pendiente${pendientes === 1 ? '' : 's'} de sincronizar.`}
        </div>
      )}

      {desdeCache && !cargandoCatalogo && (
        <div className="rounded-lg border border-accent-2/30 bg-accent-2/5 px-3 py-2 text-xs text-text-dim">
          Mostrando el catálogo guardado localmente (sin conexión al servidor).
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex flex-1 flex-col gap-3">
          <ProductSearch productos={productos} onAgregar={agregarProducto} />
          <Cart items={cart} onCambiarCantidad={cambiarCantidad} onQuitar={quitarProducto} />
        </div>

        <PaymentPanel
          subtotal={subtotal}
          cobrando={cobrando}
          disabled={cart.length === 0}
          onCobrar={handleCobrar}
        />
      </div>

      {ticket && <TicketModal data={ticket} onNuevaVenta={() => setTicket(null)} />}
    </div>
  )
}
