/** Contraste de color, para que el texto sobre el color que elija el comercio
 * se lea siempre.
 *
 * El dueño elige un acento cualquiera y ese color pinta fondos de botones. Con
 * la tinta fija que traía el tema, un acento claro (un amarillo, por ejemplo)
 * dejaba el botón principal ilegible. Acá se elige la tinta midiendo, no a ojo.
 */

/** Luminancia relativa (WCAG 2.1). 0 = negro, 1 = blanco. */
function luminancia(hex: string): number {
  const n = normalizar(hex)
  if (n === null) return 0
  const canales = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2]
}

/** Hex de seis dígitos sin '#', o null si no es un color válido. Acepta la
 * forma corta (#abc) porque es la que se tipea a mano. */
function normalizar(hex: string): string | null {
  const limpio = hex.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(limpio)) {
    return limpio.split('').map((c) => c + c).join('').toLowerCase()
  }
  return /^[0-9a-fA-F]{6}$/.test(limpio) ? limpio.toLowerCase() : null
}

export function esColorValido(hex: string): boolean {
  return normalizar(hex) !== null
}

/** '#rrggbb' en minúscula, o null. Es lo que se guarda: el backend valida seis
 * dígitos, así que la forma corta hay que expandirla antes de mandarla. */
export function aHexLargo(hex: string): string | null {
  const n = normalizar(hex)
  return n === null ? null : `#${n}`
}

/** Relación de contraste entre dos colores (1 a 21), como la define WCAG. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la]
  return (claro + 0.05) / (oscuro + 0.05)
}

/** Casi negro y casi blanco en vez de #000/#fff puros: sobre una superficie
 * de color el negro absoluto se ve como un agujero. */
const TINTA_OSCURA = '#0b0f14'
const TINTA_CLARA = '#ffffff'

/** Qué color de texto usar encima de `fondo`: el de los dos que más contraste
 * dé. No hay empate posible que importe — la diferencia siempre es grande. */
export function tintaSobre(fondo: string): string {
  return contraste(fondo, TINTA_OSCURA) >= contraste(fondo, TINTA_CLARA) ? TINTA_OSCURA : TINTA_CLARA
}
