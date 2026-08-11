import axios from 'axios'

/** DRF devuelve errores de validación como string, lista (`["msg"]`) u
 * objeto por campo (`{"campo": ["msg"]}`). Esto los aplana a un mensaje
 * legible para mostrar en un toast — nunca un genérico "no se pudo..."
 * que le esconde al usuario la razón real del rechazo (ej. "no hay stock
 * suficiente", "el motivo es obligatorio"). */
export function extraerMensajeError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data
    if (typeof data === 'string' && data.trim()) return data
    if (data && typeof data === 'object') {
      const mensaje = Object.values(data as Record<string, unknown>)
        .flat(2)
        .filter((v) => typeof v === 'string' && v.trim())
        .join(' ')
      if (mensaje) return mensaje
    }
  }
  return fallback
}
