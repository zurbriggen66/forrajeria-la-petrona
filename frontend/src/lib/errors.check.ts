/** Chequeo de extraerMensajeError, que es lo único que se interpone entre un
 * rechazo del backend y un dueño que no entiende por qué no puede cargar algo.
 *
 * Corre sin instalar nada: Node 24 entiende TypeScript directo.
 *   node --experimental-strip-types src/lib/errors.check.ts
 *
 * Dos bugs lo motivaron. El primero: la forma anidada que devuelve DRF cuando
 * falla un renglón se aplanaba a "" y el usuario veía siempre el mismo "No se
 * pudo registrar la compra". El segundo: cuando el mensaje sí llegaba, era el
 * de la librería —"Asegúrese de que no haya más de 3 decimales"— que es
 * correcto y no le dice a nadie qué hacer.
 *
 * Los textos crudos de acá salieron de correr los serializers de DRF de verdad,
 * no de memoria.
 */
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

const mensaje = (data: unknown, status = 400) => extraerMensajeError(rechazo(data, status), FALLBACK)

// ---------------------------------------------------------------------------
// 1. La forma anidada: qué fila falló
// ---------------------------------------------------------------------------

assert.equal(
  mensaje({ items: { '0': { costo_unitario: ['Asegúrese de que no haya más de 2 decimales.'] } } }),
  'Fila 1 (Costo unitario): Como mucho 2 decimales. Redondeá el número.',
)

// Numera desde 1: el dueño cuenta renglones en la pantalla, no índices.
assert.equal(
  mensaje({ items: { '2': { cantidad: ['Se requiere un número válido.'] } } }),
  'Fila 3 (Cantidad): Tiene que ser un número. Quedó vacío o con letras.',
)

// Lista de textos bajo una clave envoltorio: NO es una fila por elemento.
assert.equal(
  mensaje({ items: ['La compra necesita al menos un ítem.'] }),
  'La compra necesita al menos un ítem.',
)

// ---------------------------------------------------------------------------
// 2. Traducción de los mensajes de la librería
// ---------------------------------------------------------------------------

const traducciones: [string, string][] = [
  ['Se requiere un número válido.', 'Tiene que ser un número. Quedó vacío o con letras.'],
  ['Introduzca un número entero válido.', 'Tiene que ser un número entero, sin decimales.'],
  ['Asegúrese de que no haya más de 3 decimales.', 'Como mucho 3 decimales. Redondeá el número.'],
  ['Asegúrese de que no haya más de 1 decimales.', 'Como mucho 1 decimal. Redondeá el número.'],
  ['Asegúrese de que no haya más de 14 dígitos en total.', 'El número es demasiado largo: hasta 14 dígitos.'],
  ['Asegúrese de que este valor es mayor o igual a 0.001.', 'Tiene que ser 0.001 o más.'],
  ['Asegúrese de que este valor es menor o igual a 100.', 'No puede pasar de 100.'],
  ['Asegúrese de que este campo no tenga más de 40 caracteres.', 'Es muy largo: hasta 40 caracteres.'],
  ['Este campo es requerido.', 'Falta completar este campo.'],
  ['Este campo no puede estar en blanco.', 'Falta completar este campo.'],
  ['Fecha con formato erróneo. Use uno de los siguientes formatos en su lugar: YYYY-MM-DD.', 'La fecha no es válida. Elegila del calendario.'],
  ['Debe ser un UUID válido.', 'No se reconoce lo que elegiste. Volvé a elegirlo de la lista.'],
  ['Introduzca una dirección de correo electrónico válida.', 'El email no es válido.'],
  ['No encontrado.', 'No se encontró. Puede que lo hayan borrado desde otra pantalla.'],
]
for (const [crudo, esperado] of traducciones) {
  assert.equal(mensaje({ detail: crudo }), esperado, `no se tradujo: ${crudo}`)
}

// Ninguna traducción puede dejar el mensaje técnico a la vista.
for (const [crudo] of traducciones) {
  assert.ok(
    !/Asegúrese|Introduzca|UUID|proveyeron/i.test(mensaje({ detail: crudo })),
    `quedó jerga en la traducción de: ${crudo}`,
  )
}

// ---------------------------------------------------------------------------
// 3. Nuestros propios mensajes pasan tal cual
// ---------------------------------------------------------------------------

// Ya están escritos para el usuario y nombran la cosa concreta: traducirlos o
// ponerles "Monto:" adelante sólo los empeoraría.
const nuestros = [
  'No hay stock suficiente de "Balanceado perro" (disponible: 3).',
  'No hay una caja abierta. Abrí la caja antes de vender.',
  'Esta compra ya está saldada.',
  'Tu usuario no tiene habilitado este módulo. Pedíselo al dueño del comercio.',
  'Este reparto ya está facturado.',
]
for (const texto of nuestros) {
  assert.equal(mensaje({ detail: texto }), texto, `se modificó un mensaje nuestro: ${texto}`)
}
// Tampoco se le antepone el nombre del campo.
assert.equal(
  mensaje({ monto: ['El pago supera lo que falta pagar de esta compra (saldo: 5000).'] }),
  'El pago supera lo que falta pagar de esta compra (saldo: 5000).',
)

// Pero uno genérico SÍ lleva el campo adelante, porque solo no se entiende.
assert.equal(mensaje({ cuenta_pago: ['Este campo es requerido.'] }), 'Medio de pago: Falta completar este campo.')
assert.equal(mensaje({ fecha: ['Este campo es requerido.'] }), 'Fecha: Falta completar este campo.')

// ---------------------------------------------------------------------------
// 4. Varios errores, repetidos, y formas raras
// ---------------------------------------------------------------------------

const muchos = mensaje({
  items: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [String(i), { cantidad: [`Mal el renglón ${i}`] }])),
})
assert.ok(muchos.startsWith('Fila 1: Mal el renglón 0'), muchos)
assert.ok(muchos.endsWith('(y 2 errores más)'), muchos)

assert.equal(mensaje({ campo: ['Repetido', 'Repetido'] }), 'Repetido')
assert.equal(extraerMensajeError(rechazo('Esta compra ya está saldada.'), FALLBACK), 'Esta compra ya está saldada.')

// ---------------------------------------------------------------------------
// 5. Cuando no hay cuerpo que interpretar
// ---------------------------------------------------------------------------

const sinRed = new AxiosError('Network Error')
assert.equal(extraerMensajeError(sinRed, FALLBACK), 'No hubo respuesta del servidor. Revisá la conexión y reintentá.')

assert.equal(mensaje({}, 401), 'Se cerró tu sesión. Volvé a entrar.')
assert.equal(mensaje({}, 403), 'Tu usuario no tiene permiso para hacer esto.')
assert.equal(mensaje({}, 404), 'No se encontró. Puede que lo hayan borrado desde otra pantalla.')
// Un 500 tiene que dejar claro que NO es culpa de lo que cargó el usuario.
assert.ok(mensaje({}, 500).includes('no es culpa de lo que cargaste'), mensaje({}, 500))

// Algo que no es un error de axios: el fallback, sin adornos.
assert.equal(extraerMensajeError(new Error('boom'), FALLBACK), FALLBACK)

console.log('extraerMensajeError ok')
