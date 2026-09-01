import { useEffect, useState } from 'react'
import { Check, List, Loader2, Plus, UserRound, Wallet, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { InputDecimal } from '../../components/ui/InputDecimal'
import { MontoOPorcentaje } from '../../components/ui/MontoOPorcentaje'
import { Select } from '../../components/ui/Select'
import { formatMoney, parseDecimal } from '../../lib/format'
import { useClientesSearch, useCuentasPago } from './api'
import { ClienteSelectorModal } from './ClienteSelectorModal'
import type { Cliente } from './types'

const CUENTA_CORRIENTE = 'cuenta_corriente'
const MIXTO = 'mixto'

/** Una línea del cobro mixto. `cuentaId` vacío = Efectivo (misma convención
 * que el select de medio de pago simple). */
interface LineaPago {
  cuentaId: string
  monto: string
}

/** Redondeo a centavos: sumar strings de inputs en punto flotante deja restos
 * tipo 0.000000001 que harían que el backend rechace un cobro que en pantalla
 * cuadra perfecto. */
function aCentavos(n: number): number {
  return Math.round(n * 100) / 100
}

/** Montos de "billete rápido" para no tener que tipear el efectivo recibido:
 * el total exacto, más los próximos redondos hacia arriba (múltiplos de
 * 1.000/5.000/10.000) — lo que un cliente plausiblemente entrega en mano. */
function sugerenciasEfectivo(total: number): number[] {
  if (total <= 0) return []
  const sugeridos = new Set<number>([total])
  for (const paso of [1000, 5000, 10000]) {
    const candidato = Math.ceil(total / paso) * paso
    if (candidato > total) sugeridos.add(candidato)
  }
  return [...sugeridos].sort((a, b) => a - b).slice(0, 4)
}

export interface DatosCobro {
  cliente: Cliente | null
  cuentaPagoId: string
  cuentaCorriente: boolean
  descuento: string
  recargoMonto: string
  efectivoRecibido: string
  /** Cuenta desde la que se da el vuelto. Vacío = misma cuenta que cobró (default). */
  vueltoCuentaPagoId: string
  /** Desglose del cobro mixto. Vacío = cobro con un solo medio. */
  pagos: { cuenta_pago: string | null; monto: string }[]
}

interface Props {
  subtotal: number
  cobrando: boolean
  disabled: boolean
  onCobrar: (datos: DatosCobro) => void
  /** Precarga el cliente (ej. al cobrar un presupuesto ya vinculado a uno) —
   * se puede seguir cambiando o quitando desde acá como cualquier otro. */
  clienteInicial?: Cliente | null
  /** Precargan el descuento y el recargo. Los usa el cobro de un reparto: el
   * costo del envío entra como recargo, así queda a la vista y el cajero lo
   * puede sacar si esta vez no se lo cobra. */
  descuentoInicial?: string
  recargoInicial?: string
}

export function PaymentPanel({
  subtotal, cobrando, disabled, onCobrar,
  clienteInicial = null, descuentoInicial = '0', recargoInicial = '0',
}: Props) {
  const { data: cuentas } = useCuentasPago()
  const [cuentaPagoId, setCuentaPagoId] = useState('')
  const [descuento, setDescuento] = useState(descuentoInicial)
  const [recargoMonto, setRecargoMonto] = useState(recargoInicial)
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [vueltoCuentaPagoId, setVueltoCuentaPagoId] = useState('')
  const [pagos, setPagos] = useState<LineaPago[]>([])
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(clienteInicial)
  const [mostrarSelector, setMostrarSelector] = useState(false)
  const { data: clientesEncontrados } = useClientesSearch(busquedaCliente)

  // clienteInicial suele llegar async (ver PresupuestoCobrarModal, que lo
  // busca por id después del primer render) — el useState de arriba sólo
  // captura el valor que tenía al montar.
  useEffect(() => {
    if (clienteInicial) setCliente(clienteInicial)
  }, [clienteInicial])

  const esCuentaCorriente = cuentaPagoId === CUENTA_CORRIENTE
  const esMixto = cuentaPagoId === MIXTO
  const cuentaSeleccionada = cuentas?.find((c) => c.id === cuentaPagoId)
  const esEfectivo = !esCuentaCorriente && !esMixto && (!cuentaSeleccionada || cuentaSeleccionada.tipo === 'efectivo')

  const total = Math.max(subtotal - parseDecimal(descuento) + parseDecimal(recargoMonto), 0)
  const vuelto = esEfectivo && efectivoRecibido ? Math.max(parseDecimal(efectivoRecibido) - total, 0) : null
  const disponibleCredito = cliente ? Number(cliente.limite_credito) - Number(cliente.saldo_actual) : null

  const sumaPagos = aCentavos(pagos.reduce((acc, p) => acc + parseDecimal(p.monto), 0))
  const restante = aCentavos(total - sumaPagos)
  const mixtoCuadra = esMixto && restante === 0 && pagos.length > 0

  function nombreCuenta(cuentaId: string) {
    return cuentas?.find((c) => c.id === cuentaId)?.nombre ?? 'Efectivo'
  }

  /** Cuenta con la que arranca cada línea nueva. Se usa la cuenta real de
   * efectivo del comercio (no el "" del select simple) para no listar dos
   * opciones "Efectivo" — la genérica y la configurada — en el desglose. */
  function cuentaPorDefecto() {
    return cuentas?.find((c) => c.tipo === 'efectivo')?.id ?? cuentas?.[0]?.id ?? ''
  }

  function agregarLinea() {
    // Prellena con lo que falta: el caso normal es cargar un medio, ver el
    // resto, y cerrarlo con otro — así el cajero no tipea el segundo monto.
    setPagos((prev) => [
      ...prev,
      { cuentaId: cuentaPorDefecto(), monto: restante > 0 ? String(restante) : '' },
    ])
  }

  function activarMixto() {
    setCuentaPagoId(MIXTO)
    setEfectivoRecibido('')
    setPagos([{ cuentaId: cuentaPorDefecto(), monto: total > 0 ? String(total) : '' }])
  }

  return (
    <div className="flex w-full shrink-0 flex-col gap-4 border-t border-border bg-surface p-4 lg:w-80 lg:border-l lg:border-t-0">
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Cliente</span>
        {cliente ? (
          <div className="mt-1.5 flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
            <span className="flex items-center gap-2"><UserRound size={14} className="text-accent" /> {cliente.nombre}</span>
            <button
              onClick={() => { setCliente(null); if (esCuentaCorriente) setCuentaPagoId('') }}
              className="text-text-dim hover:text-danger"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="relative flex gap-1.5">
              <Input
                id="cliente-search" placeholder="Consumidor final (opcional)" className="flex-1"
                value={busquedaCliente} onChange={(e) => setBusquedaCliente(e.target.value)}
              />
              <button
                type="button" onClick={() => setMostrarSelector(true)}
                title="Ver todos los clientes"
                className="flex shrink-0 items-center justify-center rounded-lg border border-border px-2.5 text-text-dim hover:border-accent/50 hover:text-text"
              >
                <List size={15} />
              </button>
              {clientesEncontrados && clientesEncontrados.length > 0 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                  {clientesEncontrados.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setCliente(c); setBusquedaCliente('') }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      <span>{c.nombre}</span>
                      {c.telefono && <span className="text-xs text-text-dim">{c.telefono}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button" onClick={() => setMostrarSelector(true)}
              className="self-start text-xs text-accent hover:underline"
            >
              ¿No te acordás cómo lo agendaste? Ver la lista completa
            </button>
          </div>
        )}
      </div>

      <Select
        id="cuenta-pago" label="Medio de pago" value={cuentaPagoId}
        onChange={(e) => (e.target.value === MIXTO ? activarMixto() : setCuentaPagoId(e.target.value))}
      >
        <option value="">Efectivo</option>
        {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        <option value={MIXTO}>Pago mixto (varios medios)</option>
        <option value={CUENTA_CORRIENTE} disabled={!cliente}>
          Cuenta corriente (fiado){!cliente ? ' — elegí un cliente' : ''}
        </option>
      </Select>

      {esMixto && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/50 p-3">
          {pagos.map((linea, i) => (
            <div key={i} className="grid grid-cols-[1fr_96px_26px] items-center gap-1.5">
              <Select
                id={`pago-cuenta-${i}`}
                aria-label="Medio de pago"
                value={linea.cuentaId}
                onChange={(e) => setPagos((prev) => prev.map((p, idx) => (idx === i ? { ...p, cuentaId: e.target.value } : p)))}
                className="py-1.5 text-xs"
              >
                {/* Sólo si el comercio todavía no cargó cuentas: el backend
                    crea el contenedor Efectivo al cobrar. */}
                {(cuentas?.length ?? 0) === 0 && <option value="">Efectivo</option>}
                {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
              <InputDecimal
                id={`pago-monto-${i}`}
                aria-label={`Monto en ${nombreCuenta(linea.cuentaId)}`}
                value={linea.monto}
                onChange={(valor) => setPagos((prev) => prev.map((p, idx) => (idx === i ? { ...p, monto: valor } : p)))}
                className="!py-2 text-right text-xs"
              />
              <button
                type="button"
                onClick={() => setPagos((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={pagos.length === 1}
                className="rounded p-1 text-text-dim hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                aria-label="Quitar medio de pago"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <button
            type="button" onClick={agregarLinea}
            className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-xs text-text-dim hover:border-accent/50 hover:text-text"
          >
            <Plus size={13} /> Agregar medio
          </button>

          <div className={`flex items-center justify-between border-t border-border pt-2 text-xs font-medium ${
            mixtoCuadra ? 'text-accent-2' : restante > 0 ? 'text-warning' : 'text-danger'
          }`}>
            {mixtoCuadra ? (
              <><span className="flex items-center gap-1"><Check size={13} /> Cuadra con el total</span><span /></>
            ) : restante > 0 ? (
              <><span>Falta cargar</span><span className="tabular-nums">{formatMoney(restante)}</span></>
            ) : (
              <><span>Se pasa por</span><span className="tabular-nums">{formatMoney(-restante)}</span></>
            )}
          </div>
        </div>
      )}

      {esEfectivo && (
        <div className="flex flex-col gap-1.5">
          <InputDecimal
            id="efectivo-recibido" label="Efectivo recibido"
            value={efectivoRecibido} onChange={setEfectivoRecibido}
          />
          {total > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sugerenciasEfectivo(total).map((monto) => (
                <button
                  key={monto}
                  type="button"
                  onClick={() => setEfectivoRecibido(String(monto))}
                  className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs tabular-nums text-text-dim hover:border-accent/50 hover:text-text"
                >
                  {monto === total ? 'Exacto' : formatMoney(monto)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {esEfectivo && vuelto !== null && vuelto > 0 && (
        <Select
          id="vuelto-cuenta" label="¿En qué medio das el vuelto?" value={vueltoCuentaPagoId}
          onChange={(e) => setVueltoCuentaPagoId(e.target.value)}
        >
          <option value="">Efectivo (mismo medio que cobró)</option>
          {cuentas?.filter((c) => c.tipo !== 'efectivo').map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
      )}

      {esCuentaCorriente && disponibleCredito !== null && (
        <p className={`flex items-center gap-1.5 text-xs ${total > disponibleCredito ? 'text-danger' : 'text-text-dim'}`}>
          <Wallet size={13} /> Disponible en su cuenta: <span className="font-medium">{formatMoney(disponibleCredito)}</span>
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-3">
          <MontoOPorcentaje id="descuento" label="Descuento" base={subtotal} value={descuento} onChange={setDescuento} />
          <MontoOPorcentaje id="recargo" label="Recargo" base={subtotal} value={recargoMonto} onChange={setRecargoMonto} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm text-text-dim">
            <span>Subtotal</span><span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          {parseDecimal(descuento) > 0 && (
            <div className="flex items-center justify-between text-sm text-danger">
              <span>Descuento</span><span className="tabular-nums">−{formatMoney(descuento)}</span>
            </div>
          )}
          {parseDecimal(recargoMonto) > 0 && (
            <div className="flex items-center justify-between text-sm text-warning">
              <span>Recargo</span><span className="tabular-nums">+{formatMoney(recargoMonto)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-text">
            <span className="text-sm font-medium">Total</span>
            <span className="font-display text-2xl font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>
        {vuelto !== null && (
          <div className="flex items-center justify-between text-sm text-accent-2">
            <span>Vuelto</span><span className="tabular-nums">{formatMoney(vuelto)}</span>
          </div>
        )}

        <Button
          disabled={
            disabled || cobrando
            // Un mixto que no cuadra lo rechaza el backend igual (dejaría la
            // caja descuadrada): se bloquea acá para avisar antes, no después.
            // El límite de crédito NO bloquea: es sólo el aviso en rojo de
            // arriba — el dueño decide si le sigue fiando a ese cliente.
            || (esMixto && !mixtoCuadra)
          }
          onClick={() => onCobrar({
            cliente,
            cuentaPagoId: esCuentaCorriente || esMixto ? '' : cuentaPagoId,
            cuentaCorriente: esCuentaCorriente,
            descuento, recargoMonto, efectivoRecibido,
            vueltoCuentaPagoId: esEfectivo ? vueltoCuentaPagoId : '',
            pagos: esMixto
              ? pagos.map((p) => ({ cuenta_pago: p.cuentaId || null, monto: p.monto }))
              : [],
          })}
          className="mt-2 justify-center py-4 text-lg"
        >
          {cobrando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {esMixto && !mixtoCuadra ? 'Falta cargar el cobro' : 'Cobrar'}
        </Button>
      </div>

      {mostrarSelector && (
        <ClienteSelectorModal
          onSeleccionar={(c) => { setCliente(c); setBusquedaCliente(''); setMostrarSelector(false) }}
          onClose={() => setMostrarSelector(false)}
        />
      )}
    </div>
  )
}
