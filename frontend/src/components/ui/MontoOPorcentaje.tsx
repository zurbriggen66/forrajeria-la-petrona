import { useEffect, useRef, useState } from 'react'
import { formatMoney, parseDecimal } from '../../lib/format'
import { InputDecimal } from './InputDecimal'

interface Props {
  id: string
  label: string
  /** Sobre cuánto se calcula el porcentaje (normalmente el subtotal). */
  base: number
  /** El monto en pesos. Es lo único que sale de acá y lo único que se guarda. */
  value: string
  onChange: (monto: string) => void
}

/** Campo de descuento/recargo que acepta pesos o porcentaje.
 *
 * El porcentaje es sólo una forma de tipear: hacia afuera este componente
 * siempre entrega el monto en pesos, que es lo que guarda el backend. Así no
 * hay un segundo campo que pueda quedar desincronizado con la plata, y las
 * ventas viejas siguen leyéndose igual.
 */
export function MontoOPorcentaje({ id, label, base, value, onChange }: Props) {
  const [modo, setModo] = useState<'monto' | 'pct'>('monto')
  const [pct, setPct] = useState('')

  // onChange cambia de identidad en cada render del padre; por referencia, el
  // efecto de abajo depende sólo de lo que de verdad recalcula el monto.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // En modo porcentaje el monto se recalcula solo cuando cambia la base:
  // poner "10%" y después agregar otro producto tiene que actualizar el
  // descuento, no dejarlo clavado en el total de antes.
  useEffect(() => {
    if (modo !== 'pct') return
    const porcentaje = parseDecimal(pct)
    onChangeRef.current(((base * porcentaje) / 100).toFixed(2))
  }, [modo, pct, base])

  const equivalePct = base > 0 ? (parseDecimal(value) / base) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-text-dim">
          {label}
        </label>
        <div className="flex gap-0.5 rounded-md bg-surface-2 p-0.5">
          {(['monto', 'pct'] as const).map((m) => (
            <button
              key={m} type="button" onClick={() => setModo(m)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                modo === m ? 'bg-accent/20 text-accent' : 'text-text-dim hover:text-text'
              }`}
            >
              {m === 'monto' ? '$' : '%'}
            </button>
          ))}
        </div>
      </div>

      <InputDecimal
        id={id}
        placeholder="0"
        value={modo === 'pct' ? pct : value}
        onChange={(valor) => (modo === 'pct' ? setPct(valor) : onChange(valor))}
      />

      {/* Siempre a la vista la otra cara del número: en % cuántos pesos son, y
          en $ qué porcentaje representa. Es lo que se discute en el mostrador. */}
      {parseDecimal(value) > 0 && (
        <span className="text-[11px] tabular-nums text-text-dim">
          {modo === 'pct'
            ? `= ${formatMoney(value)}`
            : base > 0 && `= ${equivalePct.toFixed(1)}%`}
        </span>
      )}
    </div>
  )
}
