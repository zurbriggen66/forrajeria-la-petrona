import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Monta una hoja para imprimir fuera del árbol de la app.
 *
 * Va en un portal colgado de <body> porque la regla de impresión esconde a
 * todos los hermanos: si la hoja viviera dentro de un modal se escondería
 * junto con él. En pantalla no se ve nada (.hoja-impresion está en display
 * none); aparece sólo en el papel y en la vista previa del navegador.
 */
export function Imprimible({ children }: { children: ReactNode }) {
  return createPortal(<div className="hoja-impresion">{children}</div>, document.body)
}
