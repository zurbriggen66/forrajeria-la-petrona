import { useState } from 'react'
import { Check, Loader2, Plus, UserRound, Wallet, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { formatMoney } from '../../lib/format'
import { useClientesSearch, useCuentasPago } from './api'
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
  /** Desglose del cobro mixto. Vacío = cobro con un solo medio. */
  pagos: { cuenta_pago: string | null; monto: string }[]
}

interface Props {
  subtotal: number
  cobrando: boolean
  disabled: boolean
  onCobrar: (datos: DatosCobro) => void
}

export function PaymentPanel({ subtotal, cobrando, disabled, onCobrar }: Props) {
  const { data: cuentas } = useCuentasPago()
  const [cuentaPagoId, setCuentaPagoId] = useState('')
  const [descuento, setDescuento] = useState('0')
  const [recargoMonto, setRecargoMonto] = useState('0')
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [pagos, setPagos] = useState<LineaPago[]>([])
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const { data: clientesEncontrados } = useClientesSearch(busquedaCliente)

  const esCuentaCorriente = cuentaPagoId === CUENTA_CORRIENTE
  const esMixto = cuentaPagoId === MIXTO
  const cuentaSeleccionada = cuentas?.find((c) => c.id === cuentaPagoId)
  const esEfectivo = !esCuentaCorriente && !esMixto && (!cuentaSeleccionada || cuentaSeleccionada.tipo === 'efectivo')

  const total = Math.max(subtotal - Number(descuento || 0) + Number(recargoMonto || 0), 0)
  const vuelto = esEfectivo && efectivoRecibido ? Math.max(Number(efectivoRecibido) - total, 0) : null
  const disponibleCredito = cliente ? Number(cliente.limite_credito) - Number(cliente.saldo_actual) : null

  const sumaPagos = aCentavos(pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0))
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
    <div className="flex w-80 shrink-0 flex-col gap-4 border-l border-border bg-surface p-4">
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
          <div className="relative">
            <Input
              id="cliente-search" placeholder="Consumidor final (opcional)" className="mt-1.5"
              value={busquedaCliente} onChange={(e) => setBusquedaCliente(e.target.value)}
            />
            {clientesEncontrados && clientesEncontrados.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                {clientesEncontrados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCliente(c); setBusquedaCliente('') }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}
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
              <Input
                id={`pago-monto-${i}`}
                aria-label={`Monto en ${nombreCuenta(linea.cuentaId)}`}
                type="number" min="0" step="0.01" value={linea.monto}
                onChange={(e) => setPagos((prev) => prev.map((p, idx) => (idx === i ? { ...p, monto: e.target.value } : p)))}
                className="py-1.5 text-right text-xs"
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
          <Input
            id="efectivo-recibido" label="Efectivo recibido" type="number" min="0" step="0.01"
            value={efectivoRecibido} onChange={(e) => setEfectivoRecibido(e.target.value)}
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

      {esCuentaCorriente && disponibleCredito !== null && (
        <p className={`flex items-center gap-1.5 text-xs ${total > disponibleCredito ? 'text-danger' : 'text-text-dim'}`}>
          <Wallet size={13} /> Disponible en su cuenta: <span className="font-medium">{formatMoney(disponibleCredito)}</span>
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Input id="descuento" label="Descuento $" type="number" min="0" step="0.01" value={descuento} onChange={(e) => setDescuento(e.target.value)} />
          <Input id="recargo" label="Recargo $" type="number" min="0" step="0.01" value={recargoMonto} onChange={(e) => setRecargoMonto(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm text-text-dim">
            <span>Subtotal</span><span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          {Number(descuento) > 0 && (
            <div className="flex items-center justify-between text-sm text-danger">
              <span>Descuento</span><span className="tabular-nums">−{formatMoney(descuento)}</span>
            </div>
          )}
          {Number(recargoMonto) > 0 && (
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
            || (esCuentaCorriente && disponibleCredito !== null && total > disponibleCredito)
            // Un mixto que no cuadra lo rechaza el backend igual (dejaría la
            // caja descuadrada): se bloquea acá para avisar antes, no después.
            || (esMixto && !mixtoCuadra)
          }
          onClick={() => onCobrar({
            cliente,
            cuentaPagoId: esCuentaCorriente || esMixto ? '' : cuentaPagoId,
            cuentaCorriente: esCuentaCorriente,
            descuento, recargoMonto, efectivoRecibido,
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
    </div>
  )
}
