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
import { cantidadInputId, precioUnitario } from './precio'
import { PosStats } from './PosStats'
import { ProductSearch } from './ProductSearch'
import { QuickProducts } from './QuickProducts'
import { TicketModal, type TicketData } from './TicketModal'
import { useCatalogoPOS } from './useCatalogoPOS'
import { useOfflineSync } from './useOfflineSync'
import type { CartItem } from './types'
import type { Producto } from '../productos/types'

export function PosPage() {
  const { productos, loading: cargandoCatalogo, desdeCache } = useCatalogoPOS()
  const { online, pendientes, sincronizando } = useOfflineSync()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  // Sin conexión no podemos confirmar el estado de la caja: no bloqueamos el
  // POS (offline-first) y confiamos en que el backend valide al sincronizar.
  const { data: cajaActual, isLoading: cargandoCaja, isError: errorCaja } = useCajaActual()

  const [cart, setCart] = useState<CartItem[]>([])
  const [cobrando, setCobrando] = useState(false)
  const [ticket, setTicket] = useState<TicketData | null>(null)
  // Producto a granel recién agregado: en cuanto el carrito lo renderiza, le
  // pasamos el foco a su campo de peso — si no, queda cargado con "1" (kg
  // asumidos) y nada le avisa al cajero que tiene que pesarlo y corregirlo.
  const [enfocarPeso, setEnfocarPeso] = useState<string | null>(null)

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + precioUnitario(item) * Number(item.cantidad), 0),
    [cart],
  )

  useEffect(() => {
    if (!enfocarPeso) return
    const input = document.getElementById(enfocarPeso) as HTMLInputElement | null
    input?.focus()
    input?.select()
    setEnfocarPeso(null)
  }, [enfocarPeso])

  function agregarProducto(producto: Producto, esBolsa: boolean) {
    setCart((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id && i.esBolsa === esBolsa)
      if (existente) {
        const paso = esBolsa ? 1 : producto.venta_por_peso ? 0.1 : 1
        return prev.map((i) =>
          i.producto.id === producto.id && i.esBolsa === esBolsa
            ? { ...i, cantidad: String(Number(i.cantidad) + paso) }
            : i,
        )
      }
      return [...prev, { producto: producto as CartItem['producto'], cantidad: '1', esBolsa }]
    })
    if (producto.venta_por_peso && !esBolsa) {
      setEnfocarPeso(cantidadInputId(producto.id, esBolsa))
    }
  }

  function cambiarCantidad(productoId: string, esBolsa: boolean, cantidad: string) {
    // Sin guarda de "<=0 borra la línea": el stepper de +/- ya nunca baja de 1
    // (Math.max(1, …) en Cart), y en el campo de peso a granel un "0"
    // intermedio es normal mientras se tipea "0.350" — borrar la línea ahí
    // se comía el producto apenas el cajero empezaba a escribir el peso real.
    setCart((prev) =>
      prev.map((i) => (i.producto.id === productoId && i.esBolsa === esBolsa ? { ...i, cantidad } : i)),
    )
  }

  function quitarProducto(productoId: string, esBolsa: boolean) {
    setCart((prev) => prev.filter((i) => !(i.producto.id === productoId && i.esBolsa === esBolsa)))
  }

  async function handleCobrar(datos: DatosCobro) {
    if (cart.length === 0) return
    setCobrando(true)
    try {
      const total = Math.max(subtotal - Number(datos.descuento || 0) + Number(datos.recargoMonto || 0), 0)
      const resultado = await crearVenta({
        items: cart.map((i) => ({ producto: i.producto.id, cantidad: i.cantidad, es_bolsa: i.esBolsa })),
        cliente: datos.cliente?.id ?? null,
        cuenta_pago: datos.cuentaPagoId || null,
        pagos: datos.pagos.length > 0 ? datos.pagos : undefined,
        metodo_pago: datos.cuentaCorriente ? 'cuenta_corriente' : datos.cuentaPagoId ? '' : 'efectivo',
        monto_cuenta_corriente: datos.cuentaCorriente ? String(total) : undefined,
        efectivo_recibido: datos.cuentaCorriente ? null : datos.efectivoRecibido || null,
        descuento: datos.descuento,
        recargo_monto: datos.recargoMonto,
      })

      if (resultado.status === 'ok') {
        setTicket({ kind: 'ok', venta: resultado.venta })
        queryClient.invalidateQueries({ queryKey: ['estadisticas', 'resumen'] })
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

      <PosStats />

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <ProductSearch productos={productos} onAgregar={agregarProducto} />
          <QuickProducts productos={productos} onAgregar={agregarProducto} />
          <Cart items={cart} onCambiarCantidad={cambiarCantidad} onQuitar={quitarProducto} onVaciar={() => setCart([])} />
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
