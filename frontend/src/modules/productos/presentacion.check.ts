/** Chequeo de la venta fraccionada: el envase cerrado y la conversión a
 * unidad_medida.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/modules/productos/presentacion.check.ts
 *
 * Es un camino de STOCK, no de pantalla: si la conversión falla, cargar 50
 * bolsas de 25 kg mete 50 kg en el inventario en vez de 1.250, y el costo por
 * kilo sale 25 veces más caro.
 */
import assert from 'node:assert/strict'
import { aUnidadDeMedida, contenidoEnvase, etiquetaEnvase, presentacionDe } from './presentacion.ts'

const bolsa25 = { venta_por_peso: true, bolsa_kg: '25.000' }
const suelto = { venta_por_peso: true, bolsa_kg: null }
const porUnidad = { venta_por_peso: false, bolsa_kg: '25.000' }

// --- contenidoEnvase: cuándo hay presentación cerrada ---
assert.equal(contenidoEnvase(bolsa25), 25)
assert.equal(contenidoEnvase(suelto), null)
// venta_por_peso apagado: no hay envase, aunque quede un bolsa_kg viejo cargado.
assert.equal(contenidoEnvase(porUnidad), null)
// Un bolsa_kg en 0 no es un envase: dividir por él daría infinito.
assert.equal(contenidoEnvase({ venta_por_peso: true, bolsa_kg: '0' }), null)
assert.equal(contenidoEnvase({ venta_por_peso: true, bolsa_kg: 'nada' }), null)

// --- aUnidadDeMedida: el caso que motivó todo ---
// "50 bolsas" en la factura son 1.250 kg de stock.
assert.equal(aUnidadDeMedida(50, true, 25), 1250)
// El mismo 50 tipeado como kilos sueltos son 50 kg.
assert.equal(aUnidadDeMedida(50, false, 25), 50)
// Sin envase definido, lo tipeado ya está en unidad_medida.
assert.equal(aUnidadDeMedida(50, true, null), 50)
// Fracciones de envase: media bolsa de 25 son 12,5 kg.
assert.equal(aUnidadDeMedida(0.5, true, 25), 12.5)
// Un campo a medio tipear no puede propagar NaN al stock.
assert.equal(aUnidadDeMedida(NaN, true, 25), 0)
assert.equal(aUnidadDeMedida(0, true, 25), 0)

// El costo por kilo sale de dividir el total por la cantidad YA convertida:
// una bolsa de 15 kg a $36.874 son $2.458,2667/kg (el ejemplo del modelo).
const kg = aUnidadDeMedida(1, true, 15)
assert.equal(kg, 15)
assert.equal(Number((36874 / kg).toFixed(4)), 2458.2667)

// 50 bolsas a $22.000 cada una: $1.100.000 por 1.250 kg = $880/kg.
const kgTotales = aUnidadDeMedida(50, true, 25)
assert.equal(1_100_000 / kgTotales, 880)

// --- vocabulario según el rubro ---
assert.equal(presentacionDe('kg').envasePlural, 'bolsas')
assert.equal(presentacionDe('m').envasePlural, 'rollos')
assert.equal(presentacionDe('unidad').envasePlural, 'cajas')
// Unidad desconocida o vacía cae en el default (bolsa), no rompe.
assert.equal(presentacionDe(null).envasePlural, 'bolsas')
assert.equal(presentacionDe('litros-raros').envasePlural, 'bolsas')

assert.equal(etiquetaEnvase('kg', '20.000'), 'Bolsa 20kg')
assert.equal(etiquetaEnvase('m', 15), 'Rollo 15m')
assert.equal(etiquetaEnvase('unidad', 500), 'Caja 500u')

console.log('presentacion ok')
