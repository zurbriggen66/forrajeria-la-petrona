/** Armar un link de WhatsApp para escribirle a un cliente a mano.
 *
 * Distinto del envío automático del backend (core/whatsapp.py, que usa el bot):
 * esto abre WhatsApp con el mensaje ya escrito y el dueño lo manda cuando
 * quiere, o lo edita antes. Sirve igual cuando el bot está apagado, que es la
 * mayoría del tiempo.
 */

/** Deja el teléfono como lo espera wa.me: sólo dígitos, con código de país.
 *
 * Acepta lo que se tipea en el mostrador: "351 123-4567", "(0351) 1234567",
 * "+54 9 351 1234567". Saca separadores, el 0 de larga distancia, y agrega
 * 54 9 si no está — los celulares argentinos en WhatsApp van con el 9.
 *
 * ponytail: NO saca el "15" que muchos guardan después de la característica
 * ("351 15 1234567"). Sacarlo bien pide la tabla de características del país
 * (2, 3 o 4 dígitos según la zona) y no vale construirla acá: si el número
 * quedó guardado con el 15, WhatsApp va a decir que no existe y hay que
 * corregirlo en la ficha del cliente, que es donde corresponde arreglarlo.
 */
export function normalizarTelefonoAR(telefono: string): string | null {
  let digitos = (telefono ?? '').replace(/\D/g, '')
  if (!digitos) return null

  // 00 54 … (prefijo internacional tipeado a la vieja)
  if (digitos.startsWith('0054')) digitos = digitos.slice(2)
  // 0 de larga distancia nacional: no va en el formato internacional.
  else if (digitos.startsWith('0')) digitos = digitos.replace(/^0+/, '')

  if (digitos.startsWith('54')) {
    const resto = digitos.slice(2)
    // El 9 de celular: si ya está se respeta, si no se agrega.
    return resto.startsWith('9') ? digitos : `549${resto}`
  }
  // Sin código de país: se asume Argentina, que es donde está el comercio.
  return `549${digitos}`
}

/** El link para abrir el chat con el mensaje ya escrito. null si el teléfono no
 * da para armarlo — el botón se muestra apagado en vez de abrir una pestaña que
 * no lleva a ninguna parte. */
export function linkWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = normalizarTelefonoAR(telefono ?? '')
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}
