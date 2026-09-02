/** Chequeo del resumen de verificación.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/modules/ventas/verificacion.check.ts
 *
 * Es lo que le confirma al dueño que la anulación movió la deuda y el stock.
 * Si se calla o da una falsa alarma, volvemos al problema original: anulaba y
 * no sabía si había descontado.
 */
import assert from 'node:assert/strict'
import { resumenVerificacion } from './verificacion.ts'

// --- anulación de una venta fiada: la deuda queda en cero y vuelve el stock ---
const anulacion = resumenVerificacion({
  saldo: { saldo: '0.00', saldo_calculado: '0.00', coincide: true, diferencia: '0.00' },
  stock: [{ producto: 'a', nombre: 'Balanceado', delta: '3.000', stock_actual: '50.000' }],
})
assert.equal(anulacion.alerta, false)
assert.equal(anulacion.saldo, '0.00')
assert.deepEqual(anulacion.stock, [{ nombre: 'Balanceado', delta: 3 }])

// --- corrección que agrega un producto: se descuenta más stock (delta negativo) ---
const correccion = resumenVerificacion({
  saldo: { saldo: '4000.00', saldo_calculado: '4000.00', coincide: true, diferencia: '0.00' },
  stock: [{ producto: 'a', nombre: 'Maíz', delta: '-1.500', stock_actual: '8.500' }],
})
assert.equal(correccion.stock[0].delta, -1.5)
assert.equal(correccion.alerta, false)
assert.equal(correccion.diferencia, null, 'sin alerta no hay diferencia que mostrar')

// --- la cuenta desincronizada: tiene que avisar, no tragárselo ---
const desincronizada = resumenVerificacion({
  saldo: { saldo: '8999.00', saldo_calculado: '2000.00', coincide: false, diferencia: '6999.00' },
  stock: [],
})
assert.equal(desincronizada.alerta, true, 'un saldo que no cuadra tiene que dar alerta')
assert.equal(desincronizada.diferencia, '6999.00')

// --- venta de contado, sin cliente: nunca alerta (no hay cuenta que comparar) ---
const sinCliente = resumenVerificacion({
  saldo: null,
  stock: [{ producto: 'a', nombre: 'Maíz', delta: '1.000', stock_actual: '5.000' }],
})
assert.equal(sinCliente.alerta, false, 'sin cliente un "no cuadra" sería falsa alarma')
assert.equal(sinCliente.saldo, null)
assert.equal(sinCliente.stock.length, 1)

// --- nada que informar: no rompe ni inventa ---
assert.deepEqual(
  resumenVerificacion(undefined),
  { saldo: null, alerta: false, diferencia: null, stock: [] },
)
assert.deepEqual(
  resumenVerificacion({ saldo: null, stock: [] }),
  { saldo: null, alerta: false, diferencia: null, stock: [] },
)

console.log('verificacion ok')
