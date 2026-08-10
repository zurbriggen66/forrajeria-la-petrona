import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { contarPendientes, listarPendientes, quitarPendiente } from './offlineQueue'
import type { VentaResult } from './types'

/** Sincroniza la cola offline del POS: al montar, al reconectar, y cada
 * cierto intervalo por las dudas de que el evento `online` no dispare. */
export function useOfflineSync() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const refrescarContador = useCallback(() => {
    contarPendientes().then(setPendientes)
  }, [])

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine || sincronizando) return
    setSincronizando(true)
    try {
      const pendientes = await listarPendientes()
      for (const item of pendientes) {
        try {
          const { data } = await api.post<VentaResult>('/ventas/', item.payload)
          await quitarPendiente(item.sync_uuid)
          toast(`Venta offline sincronizada (ticket #${data.numero_ticket})`)
          queryClient.invalidateQueries({ queryKey: ['productos'] })
          queryClient.invalidateQueries({ queryKey: ['inventario-resumen'] })
        } catch (err) {
          if (axios.isAxiosError(err) && err.response) {
            // El servidor la rechazó (ej. se quedó sin stock mientras estaba offline):
            // no tiene sentido seguir reintentando esta venta puntual.
            await quitarPendiente(item.sync_uuid)
            toast('Una venta offline no se pudo sincronizar y se descartó — revisala.', 'error')
          } else {
            break // seguimos sin conexión real: cortamos y probamos más tarde
          }
        }
      }
    } finally {
      setSincronizando(false)
      refrescarContador()
    }
  }, [sincronizando, toast, queryClient, refrescarContador])

  useEffect(() => {
    refrescarContador()
    function goOnline() {
      setOnline(true)
      sincronizar()
    }
    function goOffline() {
      setOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    if (navigator.onLine) sincronizar()
    const interval = setInterval(() => {
      if (navigator.onLine) sincronizar()
    }, 30_000)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { online, pendientes, sincronizando, refrescarContador }
}
