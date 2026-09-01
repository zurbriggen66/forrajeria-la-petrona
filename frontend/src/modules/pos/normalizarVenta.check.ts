/** Chequeo del payload que sale hacia /api/ventas/.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/modules/pos/normalizarVenta.check.ts
 *
 * El bug que arregló esto: los campos de plata viajaban tal cual salían del
 * formulario. El cajero borraba el 0 del campo Descuento para escribir otro,
 * cobraba sin completarlo, y el servidor rechazaba la VENTA ENTERA con
 * "Se requiere un número válido" — sin decir qué campo era.
 *
 * No importa el componente: importa que lo que sale del POS sea siempre un
 * número que el backend pueda leer. Los DecimalField de DRF aceptan punto y
 * hasta N decimales, y nada más.
 */
import assert from 'node:assert/strict'
import { redondearCantidad, redondearMonto } from '../../lib/format.ts'

/** Lo que DRF acepta en un DecimalField: dígitos con punto opcional. Ni vacío,
 * ni coma, ni 'NaN', ni notación científica. */
function loLeeElBackend(valor: string) {
  return /^-?\d+(\.\d+)?$/.test(valor)
}

// --- montos: el caso exacto que rompía ---
assert.equal(redondearMonto(''), '0.00', 'el campo vaciado tiene que salir como 0, no como ""')
assert.equal(redondearMonto(null), '0.00')
assert.equal(redondearMonto(undefined), '0.00')

// La coma con la que se tipea acá nunca puede llegar cruda al servidor.
assert.equal(redondearMonto('1500,50'), '1500.50')
assert.equal(redondearMonto('0,5'), '0.50')

// Dos decimales siempre, ni más ni menos.
assert.equal(redondearMonto('1500'), '1500.00')
assert.equal(redondearMonto(1500.456), '1500.46')
assert.equal(redondearMonto('10.1'), '10.10')

// Un campo a medio tipear ("10,") no puede convertirse en NaN.
assert.equal(redondearMonto('10,'), '10.00')
assert.equal(redondearMonto('.'), '0.00')

// --- todo lo que sale tiene que ser legible por el backend ---
const tipeados = ['', '0', '0,5', '1500,50', '10.', ',5', '  ', '12345.6789', '0,001']
for (const valor of tipeados) {
  assert.ok(loLeeElBackend(redondearMonto(valor)), `monto ${JSON.stringify(valor)} salió ilegible`)
  assert.ok(loLeeElBackend(redondearCantidad(Number(valor.replace(',', '.')) || 0)), `cantidad de ${JSON.stringify(valor)} salió ilegible`)
}

// --- efectivo recibido: vacío NO es cero ---
// Vacío significa "no me dieron un billete" y el servidor no calcula vuelto;
// cero significa "me dieron cero", que no existe. Por eso va null y no '0.00'.
const comoLoManda = (v: string) => (Number(v.replace(',', '.')) > 0 ? redondearMonto(v) : null)
assert.equal(comoLoManda(''), null)
assert.equal(comoLoManda('0'), null)
assert.equal(comoLoManda('5000'), '5000.00')

console.log('normalizarVenta ok')
