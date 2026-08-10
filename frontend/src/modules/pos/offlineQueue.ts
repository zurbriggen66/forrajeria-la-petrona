import { openDB, type DBSchema } from 'idb'
import type { VentaInput } from './types'

interface VentaPendiente {
  sync_uuid: string
  payload: VentaInput
  creada_en: string
  intentos: number
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

export async function encolarVenta(payload: VentaInput) {
  const db = await dbPromise
  await db.put('ventas_pendientes', {
    sync_uuid: payload.sync_uuid,
    payload,
    creada_en: new Date().toISOString(),
    intentos: 0,
  })
}

export async function listarPendientes(): Promise<VentaPendiente[]> {
  const db = await dbPromise
  return db.getAll('ventas_pendientes')
}

export async function contarPendientes(): Promise<number> {
  const db = await dbPromise
  return db.count('ventas_pendientes')
}

export async function quitarPendiente(syncUuid: string) {
  const db = await dbPromise
  await db.delete('ventas_pendientes', syncUuid)
}

export async function incrementarIntentos(syncUuid: string) {
  const db = await dbPromise
  const actual = await db.get('ventas_pendientes', syncUuid)
  if (actual) {
    actual.intentos += 1
    await db.put('ventas_pendientes', actual)
  }
}
