/** Chequeo del contraste del color de marca.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/color.check.ts
 *
 * Es accesibilidad, no estética: el dueño elige un acento cualquiera y ese
 * color pinta el fondo del botón principal. Si la tinta se elige mal, el botón
 * de cobrar queda ilegible y nadie lo nota hasta que un cajero se queja.
 */
import assert from 'node:assert/strict'
import { aHexLargo, contraste, esColorValido, tintaSobre } from './color.ts'

// --- validación de lo que se tipea ---
assert.equal(esColorValido('#2f8fff'), true)
assert.equal(esColorValido('2f8fff'), true)
assert.equal(esColorValido('#abc'), true)
assert.equal(esColorValido('#12345'), false)
assert.equal(esColorValido('rojo'), false)
assert.equal(esColorValido(''), false)

// El backend exige seis dígitos: la forma corta hay que expandirla antes.
assert.equal(aHexLargo('#abc'), '#aabbcc')
assert.equal(aHexLargo('2F8FFF'), '#2f8fff')
assert.equal(aHexLargo('nada'), null)

// --- contraste, contra los valores de referencia de WCAG ---
assert.equal(Math.round(contraste('#ffffff', '#000000')), 21)
assert.equal(Math.round(contraste('#ffffff', '#ffffff')), 1)

// --- la tinta que se elige encima del acento ---
// Amarillo: es claro, va tinta oscura. Era el caso que rompía con tinta fija.
assert.equal(tintaSobre('#ffd400'), '#0b0f14')
assert.equal(tintaSobre('#7cf03a'), '#0b0f14')
// Bordó y violeta oscuro: van con tinta clara.
assert.equal(tintaSobre('#7a1020'), '#ffffff')
assert.equal(tintaSobre('#4c1d95'), '#ffffff')

// Sea cual sea el color elegido, lo que quede encima tiene que ser legible.
// 4.5 es el mínimo de WCAG AA para texto normal.
const paleta = [
  '#2f8fff', '#00e0a8', '#ffc21a', '#ff4444', '#a855f7', '#f97316',
  '#14b8a6', '#ec4899', '#ffffff', '#000000', '#808080', '#7f7f00',
]
for (const color of paleta) {
  const ratio = contraste(color, tintaSobre(color))
  assert.ok(ratio >= 4.5, `${color} quedó con contraste ${ratio.toFixed(2)}, por debajo de AA`)
}

// El gris medio es el peor caso posible: si ahí llega a 4.5, llega en todos.
assert.ok(contraste('#808080', tintaSobre('#808080')) >= 4.5)

console.log('color ok')
