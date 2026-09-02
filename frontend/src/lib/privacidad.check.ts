/** Chequeo del modo privado.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/privacidad.check.ts
 *
 * Lo que se prueba es la regla de qué se tapa. Un falso negativo acá deja la
 * facturación del día a la vista con el modo privado prendido, que es
 * exactamente lo que el modo tenía que evitar.
 */
import assert from 'node:assert/strict'
import { formatMoney, formatPct } from './format.ts'
import { TAPADO, esSensible } from './privacidad.ts'

// --- plata: todo lo que sale de formatMoney ---
assert.ok(esSensible(formatMoney(0)))
assert.ok(esSensible(formatMoney(1000)))
assert.ok(esSensible(formatMoney(1234567.89)))
assert.ok(esSensible(formatMoney(-500)), 'un saldo en negativo también es plata')
assert.ok(esSensible(formatMoney('80000.50')))
// Con espacios de más, que aparecen cuando el valor se arma interpolando.
assert.ok(esSensible('  $ 1.000,00  '))
// El monto en medio de una frase: los textos chicos de las tarjetas son así.
assert.ok(esSensible('$ 80.000 facturado'))
assert.ok(esSensible('3 compras · promedio $ 8.500 · última 12 ago'))
assert.ok(esSensible('pasó su límite de $ 50.000'))

// --- porcentajes: el margen es tan sensible como la plata ---
assert.ok(esSensible(formatPct(40)))
assert.ok(esSensible(formatPct(-12.5)))
assert.ok(esSensible('33,3%'))

// --- lo que se sigue viendo ---
// Cantidades sueltas: taparlas no protege nada y deja la pantalla inservible.
assert.ok(!esSensible('3'))
assert.ok(!esSensible('12 clientes'))
assert.ok(!esSensible(String(7)))
// formatPct sin dato devuelve un guión: no hay nada que tapar.
assert.ok(!esSensible(formatPct(null)))
assert.ok(!esSensible(formatPct(undefined)))
// Texto común.
assert.ok(!esSensible('Sin movimientos'))
assert.ok(!esSensible(''))

// --- adentro del JSX ---
// Las tarjetas y las tablas no siempre pasan texto pelado: el margen viene en
// un <span> pintado según si el número es bueno o malo. Si la regla no mira
// adentro, el número se escapa justo en la pantalla más sensible.
const elemento = (children: unknown) => ({ props: { children } })
assert.ok(esSensible(elemento('$ 1.000,00')))
assert.ok(esSensible(elemento(formatPct(40))))
assert.ok(esSensible(elemento(elemento('$ 500'))), 'anidado dos niveles')
assert.ok(!esSensible(elemento('Queso')))
assert.ok(!esSensible(elemento(undefined)))

// Varios hijos: alcanza con que uno tenga plata.
assert.ok(esSensible(['Total: ', '$ 1.000,00']))
assert.ok(esSensible(elemento(['Queso', elemento('$ 800')])))
assert.ok(!esSensible(['Queso', 'Lácteos']))
assert.ok(!esSensible([]))

// --- lo que no se puede leer se muestra igual (el techo declarado) ---
assert.ok(!esSensible(1000))
assert.ok(!esSensible(null))
assert.ok(!esSensible(undefined))
assert.ok(!esSensible(() => '$ 1.000'), 'una función no se ejecuta para espiarla')

// --- lo que se muestra en su lugar no deja pasar el largo del número ---
assert.ok(TAPADO.length > 0)
assert.ok(!/\d/.test(TAPADO), 'no puede quedar ningún dígito')

console.log('privacidad ok')
