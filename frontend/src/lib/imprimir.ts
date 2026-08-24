/** Abre el diálogo de impresión del navegador.
 *
 * Imprime lo que esté montado en `.hoja-impresion` (ver componente Imprimible
 * y las reglas @media print en index.css). La vista previa del navegador ya
 * sirve de control antes de gastar papel, así que no hay preview propia. */
export function imprimir() {
  window.print()
}
