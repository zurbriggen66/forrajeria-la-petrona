import axios from 'axios'

/** Claves que DRF usa de envoltorio y que al usuario no le dicen nada. */
const ENVOLTORIOS = new Set(['detail', 'non_field_errors', 'items', 'pagos'])

/** Cuántos mensajes se muestran antes de resumir: un toast con veinte
 * renglones no se lee, y con arreglar el primero suele alcanzar. */
const MAX_MENSAJES = 3

function humanizar(campo: string) {
  const texto = campo.replace(/_/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "Fila 2 (Costo unitario): " — sólo cuando el error viene de un renglón.
 * Con veinte productos cargados, saber CUÁL falló es la mitad del mensaje.
 * Un error de campo suelto se deja tal cual, como venía siendo. */
function prefijo(camino: string[]) {
  const indice = camino.find((clave) => /^\d+$/.test(clave))
  if (indice === undefined) return ''
  const campo = [...camino].reverse().find((c) => !/^\d+$/.test(c) && !ENVOLTORIOS.has(c))
  return `Fila ${Number(indice) + 1}${campo ? ` (${humanizar(campo)})` : ''}: `
}

function aplanar(valor: unknown, camino: string[]): string[] {
  if (typeof valor === 'string') {
    return valor.trim() ? [prefijo(camino) + valor.trim()] : []
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) =>
      // Una lista de textos son los mensajes de UN campo. Una lista de objetos
      // es un renglón por elemento, y ahí el índice sí es la fila.
      typeof v === 'string' ? aplanar(v, camino) : aplanar(v, [...camino, String(i)]),
    )
  }
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, v]) => aplanar(v, [...camino, clave]))
  }
  return []
}

/** DRF devuelve errores de validación como string, lista (`["msg"]`), objeto
 * por campo (`{"campo": ["msg"]}`) o —cuando el serializer tiene ítems
 * anidados— objeto por renglón (`{"items": {"0": {"cantidad": ["msg"]}}}`).
 *
 * Esto los aplana a un mensaje legible para el toast, nunca un genérico "no se
 * pudo…" que le esconde la razón real del rechazo. Antes se aplanaba con
 * `.flat(2)` y un filtro de strings, así que la forma anidada quedaba en NADA:
 * cargar una compra con un costo de cuatro decimales devolvía "No se pudo
 * registrar la compra" y el dueño no tenía forma de saber qué corregir. */
export function extraerMensajeError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data
    if (typeof data === 'string' && data.trim()) return data.trim()

    const mensajes = [...new Set(aplanar(data, []))]
    if (mensajes.length > MAX_MENSAJES) {
      const resto = mensajes.length - MAX_MENSAJES
      return `${mensajes.slice(0, MAX_MENSAJES).join(' ')} (y ${resto} error${resto === 1 ? '' : 'es'} más)`
    }
    if (mensajes.length > 0) return mensajes.join(' ')

    // Sin cuerpo que interpretar: al menos decir si fue la red o el servidor,
    // que es la diferencia entre "reintentá" y "avisá que algo se rompió".
    if (!err.response) return 'No hubo respuesta del servidor. Revisá la conexión y reintentá.'
    if (err.response.status >= 500) return `${fallback} (error ${err.response.status} del servidor).`
  }
  return fallback
}
