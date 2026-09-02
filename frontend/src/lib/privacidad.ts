/** Modo privado: qué se tapa cuando hay alguien del otro lado del mostrador.
 *
 * La regla vive acá y no adentro del componente para poder probarla: un modo
 * privado que deja escapar un número no sirve de nada, y es el tipo de falla
 * que no se nota hasta que ya la vio el cliente.
 */

/** Con qué se reemplaza el número.
 *
 * Puntos y no desenfoque: un número borroso igual deja ver cuántos dígitos
 * tiene, y de la facturación del día eso es justo lo que no se quiere mostrar
 * — 40.000 y 400.000 se distinguen de lejos nada más que por el ancho. */
export const TAPADO = '••••••'

/** Si este valor no se puede mostrar con gente mirando.
 *
 * Tapa plata (`formatMoney` → "$ 1.000,00") y porcentajes (`formatPct` →
 * "40.0%", que es el margen). Las cantidades sueltas —"3 repartos pendientes",
 * "12 clientes"— se siguen viendo: taparlas no protege nada y dejaría al dueño
 * sin la pantalla que estaba usando.
 *
 * Entra en el JSX porque las tablas no devuelven texto pelado: la columna de
 * margen devuelve un <span> pintado según si el número es bueno o malo, y sin
 * mirar adentro el número se escapaba justo en la pantalla más sensible.
 *
 * ponytail: heurística sobre el valor ya formateado, no un flag en cada
 * llamada. Cubre toda tarjeta y toda celda con plata sin tocar los 16 archivos
 * que las usan, y también las que se agreguen después. Lee `props.children` a
 * mano en vez de importar `isValidElement` de react para que el chequeo corra
 * en Node pelado; si algún día hace falta distinguir un elemento de react de
 * otro objeto con `props`, ahí sí conviene importarlo.
 */
export function esSensible(valor: unknown): boolean {
  if (typeof valor === 'string') {
    const texto = valor.trim()
    // El $ en cualquier posición y no sólo al principio: los textos chicos de
    // las tarjetas meten el monto en medio de una frase ("3 compras · promedio
    // $ 8.500 · última 12 ago"), y ahí es donde se escapaba.
    return texto.includes('$') || texto.endsWith('%')
  }
  if (Array.isArray(valor)) return valor.some(esSensible)
  if (valor !== null && typeof valor === 'object' && 'props' in valor) {
    return esSensible((valor as { props?: { children?: unknown } }).props?.children)
  }
  return false
}
