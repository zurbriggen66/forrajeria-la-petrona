import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/** md: un formulario de una columna. lg: dos columnas, o una tabla corta.
 * xl: formularios con renglones de productos (compra, presupuesto, reparto),
 * que necesitan ancho de verdad — con 2xl el nombre del producto, la cantidad
 * y el costo entraban en un canuto y cargar diez renglones era incómodo. */
const ANCHOS = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-[88rem]',
} as const

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  ancho?: keyof typeof ANCHOS
}

export function Modal({ title, onClose, children, ancho = 'md' }: ModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 backdrop-blur-sm">
      <div
        className={`w-full rounded-2xl border border-border bg-surface p-6 glow-accent ${ANCHOS[ancho]}`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-text-dim hover:bg-surface-2 hover:text-text" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
