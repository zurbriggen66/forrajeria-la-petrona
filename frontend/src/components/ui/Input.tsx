import type { FocusEvent, InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', onFocus, ...props }: InputProps) {
  // En los campos numéricos, al entrar se selecciona lo que ya hay para que
  // tipear lo reemplace. Sin esto, un campo en 0 obliga a borrar el 0 antes de
  // poder cargar el precio, en cada campo y en cada producto.
  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    if (props.type === 'number') e.target.select()
    onFocus?.(e)
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
        onFocus={handleFocus}
        className={`rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...props}
      />
    </div>
  )
}
