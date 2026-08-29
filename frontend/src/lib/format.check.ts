/** Chequeo de parseDecimal, que es el camino por donde pasa la plata.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/format.check.ts
 *
 * Existe porque el bug que arregló esto era invisible: un cajero tipeaba
 * "2,5" y el renglón se iba a $ 0,00 con el "2,5" todavía en pantalla. */
import assert from 'node:assert/strict'
import { parseDecimal } from './format.ts'

// Coma: como se tipea acá. Era lo que devolvía NaN/0 y vaciaba el renglón.
assert.equal(parseDecimal('2,5'), 2.5)
assert.equal(parseDecimal('0,350'), 0.35)
assert.equal(parseDecimal('1850000,75'), 1850000.75)

// Punto: como lo manda el backend y como quedan los valores ya normalizados.
assert.equal(parseDecimal('2.5'), 2.5)
assert.equal(parseDecimal('10'), 10)

// Vacío y a medio tipear: dan 0, no NaN — un total no puede romperse porque
// el usuario todavía no terminó de escribir.
assert.equal(parseDecimal(''), 0)
assert.equal(parseDecimal('   '), 0)
assert.equal(parseDecimal(null), 0)
assert.equal(parseDecimal(undefined), 0)

// Number pasa derecho.
assert.equal(parseDecimal(7.25), 7.25)

console.log('parseDecimal ok')
