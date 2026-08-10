import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, id, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-text-dim">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
