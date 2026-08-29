import type { FocusEvent, InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  label?: string
  /** Siempre con punto como separador ('2.5'), que es lo que entiende el
   * backend y Number(). Lo que el usuario ve puede tener coma. */
  value: string
  onChange: (valor: string) => void
}

/** Campo para plata y cantidades.
 *
 * Es type="text" y no type="number" a propósito: acá se tipea "2,5", y un
 * input numérico con coma queda inválido y devuelve '' — la cantidad se caía
 * a 0 y el renglón mostraba $ 0,00 con el "2,5" todavía escrito.
 *
 * inputMode="decimal" mantiene el teclado numérico en tablet/celular, que era
 * la única ventaja real de type="number" acá (los steppers no se usan: donde
 * hacen falta hay botones +/- propios).
 *
 * Hacia afuera SIEMPRE entrega punto; hacia adentro acepta las dos. */
export function InputDecimal({ label, id, className = '', value, onChange, onFocus, ...props }: Props) {
  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    // Mismo criterio que ui/Input: entrar al campo selecciona lo que hay, así
    // tipear lo reemplaza en vez de obligar a borrar el 0 primero.
    e.target.select()
    onFocus?.(e)
  }

  function handleChange(valor: string) {
    // Se deja pasar el separador y el vacío mientras se tipea: normalizar a
    // número en cada tecla impide escribir "2," (paso obligado para llegar a
    // "2,5"). Sólo se rechaza lo que no puede ser un número.
    if (valor !== '' && !/^\d*[.,]?\d*$/.test(valor)) return
    onChange(valor.replace(',', '.'))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-text-dim">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value.replace('.', ',')}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        className={`rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...props}
      />
    </div>
  )
}
