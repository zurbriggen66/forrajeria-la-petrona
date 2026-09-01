/** Chequeo de redondearCantidad, que es lo que impide que la aritmética de
 * JavaScript rompa una venta a granel.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/cantidad.check.ts
 *
 * El bug que arregló esto: el POS suma 0,1 kg cada vez que se toca un producto
 * a granel. `1.1 + 0.1` en JavaScript da `1.2000000000000002` — dieciséis
 * decimales. El backend acepta tres (VentaItem.cantidad es decimal_places=3) y
 * rechazaba la venta entera, mientras el cajero veía "1,2" en pantalla y no
 * tenía forma de entender ni de arreglar el error.
 */
import assert from 'node:assert/strict'
import { parseDecimal, redondearCantidad } from './format.ts'

/** Los mismos tres decimales que la columna del backend. */
function decimales(texto: string) {
  const punto = texto.indexOf('.')
  return punto === -1 ? 0 : texto.length - punto - 1
}

// --- el caso exacto que rompía ---
assert.equal(String(1.1 + 0.1), '1.2000000000000002', 'si esto cambia, JavaScript dejó de ser JavaScript')
assert.equal(redondearCantidad(1.1 + 0.1), '1.2')
assert.equal(redondearCantidad(0.35 + 0.1), '0.45')
assert.equal(redondearCantidad(0.1 + 0.2), '0.3')

// Tocar el producto muchas veces seguidas, que es como se acumulaba la basura.
let cantidad = 1
for (let i = 0; i < 40; i++) {
  cantidad = parseDecimal(redondearCantidad(cantidad + 0.1))
}
assert.equal(redondearCantidad(cantidad), '5')

// --- nunca más de tres decimales, pase lo que pase ---
for (const valor of [1 / 3, 2 / 3, 0.0005, 1234.56789, 1e-9, 0.9995]) {
  assert.ok(decimales(redondearCantidad(valor)) <= 3, `${valor} salió con más de 3 decimales`)
}

// --- fracciones de kilo, que es de lo que se trata ---
assert.equal(redondearCantidad(0.5), '0.5')
assert.equal(redondearCantidad(0.35), '0.35')
assert.equal(redondearCantidad(0.001), '0.001')
// Sin ceros de cola: el campo del carrito muestra esto mientras se tipea.
assert.equal(redondearCantidad(1), '1')
assert.equal(redondearCantidad(2.5), '2.5')

// --- basura no puede llegar al servidor como "NaN" ---
assert.equal(redondearCantidad(NaN), '0')
assert.equal(redondearCantidad(Infinity), '0')

// --- ida y vuelta: lo que se manda se puede volver a leer ---
for (const valor of [0.5, 0.35, 1.2, 12.345]) {
  assert.equal(parseDecimal(redondearCantidad(valor)), valor)
}

console.log('redondearCantidad ok')
