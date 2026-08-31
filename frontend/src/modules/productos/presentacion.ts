/** Vocabulario de la venta fraccionada, según qué se venda.
 *
 * El mecanismo es uno solo (vender suelto desde una presentación cerrada) pero
 * la palabra cambia con el rubro: "bolsa" sirve para alimento balanceado y no
 * para la soga, que viene en rollo, ni para los tornillos, que vienen en caja.
 * Los campos del backend se siguen llamando bolsa_kg/precio_bolsa por historia
 * — acá sólo se traduce a lo que el cajero espera leer.
 */

export const UNIDADES = ['unidad', 'kg', 'g', 'lt', 'm'] as const

interface Presentacion {
  /** Cómo se llama el envase cerrado: bolsa, rollo, caja… */
  envase: string
  envasePlural: string
  /** Cómo se lee la unidad suelta en una etiqueta. */
  suelto: string
  /** Ejemplo concreto, para el texto de ayuda del formulario. */
  ejemplo: string
}

const POR_UNIDAD: Record<string, Presentacion> = {
  kg: { envase: 'bolsa', envasePlural: 'bolsas', suelto: 'por kg', ejemplo: 'alimento balanceado suelto, y también en bolsas de 20 kg' },
  g: { envase: 'paquete', envasePlural: 'paquetes', suelto: 'por gramo', ejemplo: 'semillas sueltas, y también en paquetes de 500 g' },
  lt: { envase: 'bidón', envasePlural: 'bidones', suelto: 'por litro', ejemplo: 'desinfectante suelto, y también en bidones de 5 lt' },
  m: { envase: 'rollo', envasePlural: 'rollos', suelto: 'por metro', ejemplo: 'soga cortada por metro, y también el rollo entero de 15 m' },
  unidad: { envase: 'caja', envasePlural: 'cajas', suelto: 'por unidad', ejemplo: 'tornillos de a uno, y también la caja cerrada de 500' },
}

const POR_DEFECTO = POR_UNIDAD.kg

export function presentacionDe(unidad: string | null | undefined): Presentacion {
  return POR_UNIDAD[unidad ?? ''] ?? POR_DEFECTO
}

/** Etiqueta del botón/renglón de la presentación cerrada: "Rollo 15m",
 * "Caja 500u", "Bolsa 20kg". */
export function etiquetaEnvase(unidad: string | null | undefined, contenido: string | number | null | undefined): string {
  const { envase } = presentacionDe(unidad)
  const nombre = envase.charAt(0).toUpperCase() + envase.slice(1)
  const cantidad = Number(contenido) || 0
  // "500 unidad" se lee mal; en el resto la abreviatura va pegada al número.
  const sufijo = unidad === 'unidad' ? 'u' : unidad ?? ''
  return `${nombre} ${cantidad}${sufijo}`
}

/** Cuánto trae el envase cerrado (kg, metros, unidades), o null si el producto
 * no tiene presentación cerrada definida.
 *
 * No es lo mismo que `tieneBolsa` del POS: ese además exige que ya tenga
 * precio de bolsa, porque para vender hace falta. Acá alcanza con que el
 * envase exista — al comprar se carga por bolsas igual, y al ponerle precio
 * justamente queremos poder ponerle el primero.
 */
export function contenidoEnvase(
  producto: { venta_por_peso: boolean; bolsa_kg: string | null },
): number | null {
  if (!producto.venta_por_peso) return null
  const contenido = Number(producto.bolsa_kg)
  return Number.isFinite(contenido) && contenido > 0 ? contenido : null
}

/** Pasa una cantidad tipeada a unidad_medida, que es como el sistema guarda el
 * stock y el costo.
 *
 * La factura del proveedor dice "50 bolsas" y el stock va en kg: sin esta
 * traducción, cargar 50 bolsas de 25 kg metía 50 kg en el inventario en vez de
 * 1.250, y el costo por kg salía 25 veces más caro.
 *
 * `contenido` null (producto sin envase cerrado) o `enEnvase` false devuelven
 * la cantidad tal cual: ya está en unidad_medida.
 */
export function aUnidadDeMedida(cantidad: number, enEnvase: boolean, contenido: number | null): number {
  if (!Number.isFinite(cantidad)) return 0
  if (!enEnvase || !contenido) return cantidad
  return cantidad * contenido
}
