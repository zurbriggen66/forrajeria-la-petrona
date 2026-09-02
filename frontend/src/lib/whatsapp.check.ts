/** Chequeo del link de WhatsApp.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/whatsapp.check.ts
 *
 * El teléfono se tipea a mano en el mostrador y viene de mil formas. Si el
 * número sale mal, el botón abre un chat con un desconocido o con nadie — y el
 * dueño no se entera hasta que el cliente no le contesta.
 */
import assert from 'node:assert/strict'
import { linkWhatsapp, normalizarTelefonoAR } from './whatsapp.ts'

// --- las formas en que se tipea un celular en el mostrador ---
assert.equal(normalizarTelefonoAR('3511234567'), '5493511234567')
assert.equal(normalizarTelefonoAR('351 123-4567'), '5493511234567')
assert.equal(normalizarTelefonoAR('(0351) 1234567'), '5493511234567')
assert.equal(normalizarTelefonoAR('0351 1234567'), '5493511234567')

// Ya con código de país, en sus variantes.
assert.equal(normalizarTelefonoAR('+54 9 351 1234567'), '5493511234567')
assert.equal(normalizarTelefonoAR('5493511234567'), '5493511234567')
// Con 54 pero sin el 9 de celular: se lo agrega.
assert.equal(normalizarTelefonoAR('543511234567'), '5493511234567')
// Prefijo internacional tipeado a la vieja.
assert.equal(normalizarTelefonoAR('00543511234567'), '5493511234567')

// No duplica el 9 cuando ya estaba.
assert.equal(normalizarTelefonoAR('+5493511234567'), '5493511234567')
assert.ok(!normalizarTelefonoAR('5493511234567')!.startsWith('54993'))

// --- lo que no se puede armar ---
assert.equal(normalizarTelefonoAR(''), null)
assert.equal(normalizarTelefonoAR('   '), null)
assert.equal(normalizarTelefonoAR('sin teléfono'), null)
assert.equal(linkWhatsapp(null, 'hola'), null)
assert.equal(linkWhatsapp(undefined, 'hola'), null)

// --- el link ---
const link = linkWhatsapp('351 123-4567', 'Hola Doña Rosa, tu saldo es $ 5.000,00')
assert.equal(
  link,
  'https://wa.me/5493511234567?text=Hola%20Do%C3%B1a%20Rosa%2C%20tu%20saldo%20es%20%24%205.000%2C00',
)
// Todo lo que sale es una URL de wa.me válida, con el texto escapado.
assert.ok(link!.startsWith('https://wa.me/'))
assert.doesNotThrow(() => new URL(link!))

// Un mensaje con saltos de línea y emojis (los recibos los usan) no rompe la URL.
const conSaltos = linkWhatsapp('3511234567', 'Ticket #12\n💰 Total: $ 1.000\n\nGracias!')!
assert.doesNotThrow(() => new URL(conSaltos))
assert.ok(!conSaltos.includes('\n'), 'los saltos de línea tienen que ir escapados')

console.log('whatsapp ok')
