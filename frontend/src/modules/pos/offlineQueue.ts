import { openDB, type DBSchema } from 'idb'
import type { VentaInput } from './types'

export interface VentaPendiente {
  sync_uuid: string
  payload: VentaInput
  creada_en: string
  intentos: number
  /** 'rechazada' = el servidor la contestó con un error (ej. se quedó sin
   * stock mientras el POS estaba offline). Sigue guardada a propósito: antes
   * se borraba y sólo quedaba un toast de 4 segundos, así que si el cajero no
   * estaba mirando la venta se perdía sin dejar rastro. */
  estado?: 'pendiente' | 'rechazada'
  motivo?: string
  /** Total al momento de cobrarla, para poder identificarla en la lista sin
   * tener que recalcular el payload entero. */
  total?: number
}

interface PosDB extends DBSchema {
  ventas_pendientes: {
    key: string
    value: VentaPendiente
  }
}

const dbPromise = openDB<PosDB>('tienda-ia-pos', 1, {
  upgrade(db) {
    db.createObjectStore('ventas_pendientes', { keyPath: 'sync_uuid' })
  },
})

export async function encolarVenta(payload: VentaInput, total?: number) {
  const db = await dbPromise
  await db.put('ventas_pendientes', {
    sync_uuid: payload.sync_uuid,
    payload,
    creada_en: new Date().toISOString(),
    intentos: 0,
    estado: 'pendiente',
    total,
  })
}

export async function listarPendientes(): Promise<VentaPendiente[]> {
  const db = await dbPromise
  return db.getAll('ventas_pendientes')
}

/** Sólo las que todavía se van a reintentar solas. Las rechazadas quedan
 * guardadas pero fuera del ciclo automático: ya sabemos que el servidor las
 * contesta con error, reintentarlas en loop no cambia nada. */
export async function listarPorSincronizar(): Promise<VentaPendiente[]> {
  return (await listarPendientes()).filter((v) => v.estado !== 'rechazada')
}

export async function contarPendientes(): Promise<number> {
  return (await listarPorSincronizar()).length
}

export async function contarRechazadas(): Promise<number> {
  return (await listarPendientes()).filter((v) => v.estado === 'rechazada').length
}

export async function quitarPendiente(syncUuid: string) {
  const db = await dbPromise
  await db.delete('ventas_pendientes', syncUuid)
}

/** Marca la venta como rechazada con el motivo, en vez de borrarla. */
export async function marcarRechazada(syncUuid: string, motivo: string) {
  const db = await dbPromise
  const actual = await db.get('ventas_pendientes', syncUuid)
  if (!actual) return
  await db.put('ventas_pendientes', { ...actual, estado: 'rechazada', motivo })
}

/** Vuelve a poner una rechazada en la cola, para reintentarla a mano después
 * de arreglar lo que la trababa (cargar stock, abrir la caja, etc.). */
export async function reencolar(syncUuid: string) {
  const db = await dbPromise
  const actual = await db.get('ventas_pendientes', syncUuid)
  if (!actual) return
  await db.put('ventas_pendientes', { ...actual, estado: 'pendiente', motivo: undefined })
}

export async function incrementarIntentos(syncUuid: string) {
  const db = await dbPromise
  const actual = await db.get('ventas_pendientes', syncUuid)
  if (actual) {
    actual.intentos += 1
    await db.put('ventas_pendientes', actual)
  }
}
