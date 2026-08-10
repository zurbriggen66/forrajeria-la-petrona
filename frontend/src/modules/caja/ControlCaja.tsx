import { useState } from 'react'
import { CreditCard, Landmark, Loader2, Lock, Unlock, Wallet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { KpiCard } from '../../components/ui/KpiCard'
import { formatMoney } from '../../lib/format'
import { useCajaActual } from './api'
import { AbrirCajaForm } from './AbrirCajaForm'
import { CerrarCajaModal } from './CerrarCajaModal'
import type { CajaSesionActual } from './types'

const ICONO_POR_TIPO: Record<string, typeof Wallet> = {
  efectivo: Wallet,
  tarjeta: CreditCard,
  banco: Landmark,
  transferencia: Landmark,
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function ControlCaja() {
  const { data: sesion, isLoading } = useCajaActual()
  // Snapshot propio en vez de leer `sesion` en vivo: al cerrar la caja la
  // query se invalida y `sesion` pasa a null, lo que haría desaparecer el
  // modal (y el resultado del arqueo) antes de que el usuario lo vea.
  const [sesionACerrar, setSesionACerrar] = useState<CajaSesionActual | null>(null)

  return (
    <div className="flex flex-col gap-5">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando caja…
        </div>
      ) : !sesion ? (
        <>
          <h1 className="font-display text-xl font-semibold text-text">Control de Caja</h1>
          <AbrirCajaForm />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-xl font-semibold text-text">Control de Caja</h1>
            <Button variant="danger" onClick={() => setSesionACerrar(sesion)}>
              <Lock size={15} /> Cerrar Turno
            </Button>
          </div>

          <div className="rounded-2xl border border-accent-2/30 bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-accent-2">
                <Unlock size={16} /> Tu Caja Abierta
              </span>
              <span className="text-xs text-text-dim">Desde {formatFecha(sesion.fecha_apertura)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard label="Cajero" value={sesion.cajero_nombre ?? '—'} icon={Wallet} />
              <KpiCard label="Apertura" value={formatMoney(sesion.monto_apertura)} icon={Wallet} />
              <KpiCard label="Ventas efectivo" value={formatMoney(sesion.ventas_efectivo)} accent="accent-2" icon={Wallet} />
              <KpiCard label="Retiros" value={formatMoney(sesion.retiros)} accent="danger" icon={Wallet} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-text">
              <Wallet size={16} className="text-accent" /> Contenedores de Dinero
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {sesion.contenedores.map((c) => {
                const Icon = ICONO_POR_TIPO[c.tipo] ?? Wallet
                return (
                  <KpiCard
                    key={c.cuenta}
                    label={c.nombre}
                    value={formatMoney(c.saldo_turno)}
                    subtitle="saldo del turno"
                    icon={Icon}
                  />
                )
              })}
              {sesion.contenedores.length === 0 && (
                <p className="col-span-full text-sm text-text-dim">
                  Todavía no cargaste cuentas de pago. Sumalas en "Cuentas y Cajas".
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {sesionACerrar && <CerrarCajaModal sesion={sesionACerrar} onClose={() => setSesionACerrar(null)} />}
    </div>
  )
}
