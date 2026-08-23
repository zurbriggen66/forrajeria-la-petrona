/** Descarga una tabla como CSV, para pasarle los números al contador.
 *
 * Se arma en el navegador con los datos ya traídos en vez de pedirle el
 * archivo al servidor: no hace falta un endpoint aparte ni resolver la
 * autenticación de una descarga directa.
 *
 * Separador `;` y coma decimal: es lo que espera Excel en configuración
 * regional argentina — con `,` abre todo en una sola columna. */
export function descargarCSV(nombre: string, columnas: string[], filas: (string | number)[][]) {
  const celda = (v: string | number) => {
    const texto = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '')
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  const contenido = [columnas, ...filas].map((f) => f.map(celda).join(';')).join('\r\n')

  // BOM para que Excel reconozca UTF-8 y no rompa los acentos.
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
