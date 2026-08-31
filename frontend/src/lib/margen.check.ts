/** Chequeo de la aritmética de margen, que decide a cuánto se vende todo.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/margen.check.ts
 *
 * Lo importante que fija: que sea margen SOBRE LA VENTA (la convención del
 * backend) y no markup sobre el costo, y que las dos direcciones sean
 * inversas exactas — si no, tocar el margen y volver atrás cambiaba el precio.
 */
import assert from 'node:assert/strict'
import { margenDesdePrecio, precioDesdeMargen } from './margen.ts'

// La misma cuenta que get_margen_pct del backend: (1200-800)/1200 = 33.33%
assert.equal(Math.round(margenDesdePrecio(800, 1200)! * 100) / 100, 33.33)

// Sobre la venta, NO markup sobre el costo: costo 100, venta 200 -> 50%.
assert.equal(margenDesdePrecio(100, 200), 50)

// Ida y vuelta: el precio que deja 50% de margen sobre 100 de costo es 200.
assert.equal(precioDesdeMargen(100, 50), 200)
assert.equal(margenDesdePrecio(100, precioDesdeMargen(100, 50)!), 50)

// Un margen cualquiera tiene que sobrevivir el round-trip.
for (const margen of [0, 12.5, 33.33, 60, 87.4]) {
  const precio = precioDesdeMargen(1422.76, margen)!
  assert.ok(Math.abs(margenDesdePrecio(1422.76, precio)! - margen) < 1e-9, `round-trip roto en ${margen}%`)
}

// Margen negativo = vender a pérdida. Es válido, no se bloquea: a veces se
// liquida mercadería. Sólo tiene que dar un número coherente.
assert.equal(precioDesdeMargen(100, -100), 50)
assert.equal(margenDesdePrecio(100, 50), -100)

// 100% o más no es alcanzable: el precio se iría a infinito.
assert.equal(precioDesdeMargen(100, 100), null)
assert.equal(precioDesdeMargen(100, 150), null)

// Sin precio de venta no hay margen que calcular (mismo criterio que el
// backend, que devuelve null).
assert.equal(margenDesdePrecio(100, 0), null)
assert.equal(margenDesdePrecio(100, -5), null)

// Basura (un campo a medio tipear llega como NaN) no puede devolver NaN.
assert.equal(margenDesdePrecio(NaN, 200), null)
assert.equal(precioDesdeMargen(100, NaN), null)

// Costo 0 (mercadería bonificada): el margen es todo el precio.
assert.equal(margenDesdePrecio(0, 500), 100)

console.log('margen ok')
