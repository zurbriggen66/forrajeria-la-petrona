import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-brand text-[#0a0714] font-semibold shadow-[0_8px_24px_-8px_rgba(124,92,255,0.6)] hover:brightness-110',
  secondary: 'bg-surface-2 text-text border border-border hover:border-accent/50',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
  ghost: 'bg-transparent text-text-dim hover:text-text hover:bg-surface-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
