/** Chequeo de extraerMensajeError, que es lo único que se interpone entre un
 * rechazo del backend y un dueño que no entiende por qué no puede cargar algo.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/errors.check.ts
 *
 * Existe porque el bug que arregló esto era invisible: la forma anidada que
 * devuelve DRF cuando falla un renglón se aplanaba a "" y el usuario veía
 * siempre el mismo "No se pudo registrar la compra". */
import assert from 'node:assert/strict'
import { AxiosError, AxiosHeaders } from 'axios'
import { extraerMensajeError } from './errors.ts'

const FALLBACK = 'No se pudo registrar la compra'

/** Un rechazo del backend tal como lo ve el front. */
function rechazo(data: unknown, status = 400) {
  const err = new AxiosError('Request failed')
  err.response = { data, status, statusText: '', headers: new AxiosHeaders(), config: { headers: new AxiosHeaders() } }
  return err
}

// El caso que rompía: error por renglón, la forma que devuelve DRF con items
// anidados. Antes daba "" y caía al fallback.
assert.equal(
  extraerMensajeError(rechazo({ items: { '0': { costo_unitario: ['Asegúrese de que no haya más de 2 decimales.'] } } }), FALLBACK),
  'Fila 1 (Costo unitario): Asegúrese de que no haya más de 2 decimales.',
)

// Numera desde 1: el dueño cuenta renglones en la pantalla, no índices.
assert.equal(
  extraerMensajeError(rechazo({ items: { '2': { cantidad: ['Se requiere un número válido.'] } } }), FALLBACK),
  'Fila 3 (Cantidad): Se requiere un número válido.',
)

// Error de campo suelto: se muestra tal cual, sin inventarle una fila.
assert.equal(
  extraerMensajeError(rechazo({ monto: ['El pago supera lo que falta pagar de esta compra (saldo: 5000).'] }), FALLBACK),
  'El pago supera lo que falta pagar de esta compra (saldo: 5000).',
)

// Lista de textos bajo una clave envoltorio: NO es una fila por elemento.
assert.equal(
  extraerMensajeError(rechazo({ items: ['La compra necesita al menos un ítem.'] }), FALLBACK),
  'La compra necesita al menos un ítem.',
)

// `detail` a secas (ValidationError con string) y string crudo.
assert.equal(extraerMensajeError(rechazo({ detail: 'Esta compra ya está saldada.' }), FALLBACK), 'Esta compra ya está saldada.')
assert.equal(extraerMensajeError(rechazo('Esta compra ya está saldada.'), FALLBACK), 'Esta compra ya está saldada.')

// Varios renglones fallados: se cortan a tres y se dice cuántos quedan.
const muchos = extraerMensajeError(
  rechazo({ items: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [String(i), { cantidad: [`Mal el renglón ${i}`] }])) }),
  FALLBACK,
)
assert.ok(muchos.startsWith('Fila 1 (Cantidad): Mal el renglón 0'), muchos)
assert.ok(muchos.endsWith('(y 2 errores más)'), muchos)

// Mensajes repetidos en varios renglones no se muestran cinco veces iguales.
assert.equal(
  extraerMensajeError(rechazo({ campo: ['Repetido', 'Repetido'] }), FALLBACK),
  'Repetido',
)

// Sin respuesta = problema de red, no de datos: hay que decirlo distinto.
const sinRed = new AxiosError('Network Error')
assert.equal(extraerMensajeError(sinRed, FALLBACK), 'No hubo respuesta del servidor. Revisá la conexión y reintentá.')

// 500 con cuerpo vacío: el fallback, pero avisando que se rompió el servidor.
assert.equal(extraerMensajeError(rechazo({}, 500), FALLBACK), `${FALLBACK} (error 500 del servidor).`)

// Algo que no es un error de axios: el fallback, sin adornos.
assert.equal(extraerMensajeError(new Error('boom'), FALLBACK), FALLBACK)

console.log('extraerMensajeError ok')
