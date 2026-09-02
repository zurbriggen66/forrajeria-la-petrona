import type { VerificacionVenta } from './api'

/** Lo que hay que mostrar de una anulación o una corrección, ya resuelto.
 *
 * Sin nada formateado: el componente le pone formatMoney y redondearCantidad.
 * Así este archivo no importa nada en tiempo de ejecución y su chequeo corre
 * en Node pelado, que es lo que hace que la regla de `alerta` esté probada.
 */
export interface ResumenVerificacion {
  /** Saldo del cliente después de la operación. null si la venta no tenía cliente. */
  saldo: string | null
  /** El saldo guardado no coincide con la suma de los movimientos. */
  alerta: boolean
  /** Cuánto se desvía el saldo guardado. Sólo cuando hay alerta. */
  diferencia: string | null
  /** Qué se movió de stock. `delta` positivo es lo que volvió. */
  stock: { nombre: string; delta: number }[]
}

/** Resuelve qué mostrar después de anular o corregir una venta.
 *
 * Las dos operaciones tocan la deuda del cliente y el stock de una sola
 * pasada, y hasta ahora la única forma de comprobar que quedó bien era ir a
 * buscar el producto y la ficha del cliente a mano. El dueño ya se comió una
 * anulación que no le descontó la deuda: verlo apenas pasa es la diferencia
 * entre enterarse ahora y enterarse cuando el cliente discute el saldo.
 *
 * `alerta` no acusa a esta operación: significa que la cuenta ya venía
 * desincronizada. Pero es justo el momento de avisarlo. Sin cliente no se
 * prende nunca — no hay cuenta contra la que comparar, y un cartel de "no
 * cuadra" en una venta de contado sería una falsa alarma.
 */
export function resumenVerificacion(verificacion?: VerificacionVenta): ResumenVerificacion {
  const saldo = verificacion?.saldo ?? null
  return {
    saldo: saldo ? saldo.saldo : null,
    alerta: saldo ? !saldo.coincide : false,
    diferencia: saldo && !saldo.coincide ? saldo.diferencia : null,
    stock: (verificacion?.stock ?? []).map((fila) => ({
      nombre: fila.nombre,
      delta: Number(fila.delta),
    })),
  }
}
