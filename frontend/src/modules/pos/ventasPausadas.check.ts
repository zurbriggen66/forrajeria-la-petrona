/** Chequeo del pausado de ventas: el mostrador atiende a dos clientes a la vez
 * y lo único que no se puede hacer es perder una venta a medio cargar.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/modules/pos/ventasPausadas.check.ts
 */
import assert from 'node:assert/strict'

// localStorage no existe en Node: alcanza un Map, el módulo sólo usa get/set.
const almacen = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => almacen.get(k) ?? null,
  setItem: (k: string, v: string) => { almacen.set(k, v) },
  removeItem: (k: string) => { almacen.delete(k) },
  clear: () => almacen.clear(),
  key: () => null,
  length: 0,
} as Storage

const {
  guardarCarrito, leerCarrito, listarPausadas, pausarVenta, quitarPausada,
} = await import('./ventasPausadas.ts')
type Item = ReturnType<typeof leerCarrito>[number]
type ItemProducto = Extract<Item, { tipo: 'producto' }>

const item = (nombre: string): Item => ({
  tipo: 'producto',
  producto: { id: nombre, nombre } as ItemProducto['producto'],
  cantidad: '1',
  esBolsa: false,
  descuentoPct: '',
})

/** Un pack en el carrito: no tiene producto ni bolsa, y el nombre de la venta
 * pausada tiene que salir igual. */
const pack = (nombre: string): Item => ({
  tipo: 'pack',
  pack: { id: nombre, nombre, precio: '100000', armables: 3, detalle: '10x Balanceado' },
  cantidad: '1',
  descuentoPct: '',
})

// Arranca vacío y no explota con localStorage sin nada guardado.
assert.deepEqual(listarPausadas(), [])
assert.deepEqual(leerCarrito(), [])

// El carrito en curso sobrevive a irse de la pantalla.
guardarCarrito([item('Alimento perro 22kg')])
assert.equal(leerCarrito().length, 1)
const guardado = leerCarrito()[0]
assert.equal(guardado.tipo, 'producto')
assert.equal((guardado as ItemProducto).producto.nombre, 'Alimento perro 22kg')

// Pausar: la más nueva queda primera, y el nombre dice cuántas más lleva.
pausarVenta([item('Maíz partido'), item('Balanceado'), item('Alfalfa')])
let pausadas = pausarVenta([item('Sal gruesa')])
assert.equal(pausadas.length, 2)
assert.equal(pausadas[0].nombre, 'Sal gruesa')
assert.equal(pausadas[1].nombre, 'Maíz partido +2')

// Ids únicos: dos ventas iguales pausadas seguidas no se pisan.
pausadas = pausarVenta([item('Sal gruesa')])
assert.equal(pausadas.length, 3)
assert.equal(new Set(pausadas.map((v) => v.id)).size, 3)

// Retomar una con el carrito ocupado (lo que hace PosPage.retomarVenta):
// sale la retomada y entra la que estaba en el mostrador — el total no baja.
const retomada = pausadas[0]
let listado = quitarPausada(retomada.id)
assert.equal(listado.length, 2)
listado = pausarVenta([item('Cuero para perro')])
assert.equal(listado.length, 3, 'la venta que estaba cargada tiene que quedar pausada, no perderse')
assert.equal(listado[0].nombre, 'Cuero para perro')
assert.ok(!listado.some((v) => v.id === retomada.id), 'la retomada ya no puede seguir pausada')

// Descartar saca sólo esa.
listado = quitarPausada(listado[1].id)
assert.equal(listado.length, 2)

// JSON corrupto (localStorage manoseado, versión vieja): arranca vacío en vez
// de romper el POS entero.
almacen.set('pos-ventas-pausadas', '{esto no es json')
assert.deepEqual(listarPausadas(), [])

console.log('ventasPausadas ok')

// Un pack sobrevive el guardado igual que un producto, y da nombre a la venta
// pausada: antes el nombre se leía de `producto.nombre`, que en un pack no existe.
guardarCarrito([pack('10 balanceados'), item('Sal gruesa')])
const conPack = leerCarrito()
assert.equal(conPack.length, 2)
assert.equal(conPack[0].tipo, 'pack')

let listadoPack = pausarVenta([pack('10 balanceados'), item('Sal gruesa')])
assert.equal(listadoPack[0].nombre, '10 balanceados +1')
listadoPack = pausarVenta([pack('100 huevos')])
assert.equal(listadoPack[0].nombre, '100 huevos')

console.log('ventasPausadas con packs ok')
