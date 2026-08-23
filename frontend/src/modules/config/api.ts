import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ComercioConfig, ComercioConfigInput, InvitarUsuarioInput, Paginated, UsuarioComercio } from './types'

export function useComercioConfig() {
  return useQuery({
    queryKey: ['comercio-config'],
    queryFn: async () => {
      const { data } = await api.get<ComercioConfig>('/auth/comercio/')
      return data
    },
  })
}

export function useUpdateComercioConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ComercioConfigInput) => {
      const { data } = await api.patch<ComercioConfig>('/auth/comercio/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comercio-config'] }),
  })
}

export function useUsuariosComercio() {
  return useQuery({
    queryKey: ['usuarios-comercio'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<UsuarioComercio>>('/auth/usuarios/', { params: { page_size: 100 } })
      return data.results
    },
  })
}

export function useInvitarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: InvitarUsuarioInput) => {
      const { data } = await api.post<UsuarioComercio>('/auth/usuarios/', input)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios-comercio'] }),
  })
}

export function useActualizarRolUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rol }: { id: string; rol: string }) => {
      const { data } = await api.patch<UsuarioComercio>(`/auth/usuarios/${id}/`, { rol })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios-comercio'] }),
  })
}

export function useQuitarUsuario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/usuarios/${id}/`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios-comercio'] }),
  })
}

export function useCambiarUsuario() {
  return useMutation({
    mutationFn: async (username: string) => {
      const { data } = await api.patch<{ username: string }>('/auth/me/usuario/', { username })
      return data
    },
  })
}

export function useCambiarPassword() {
  return useMutation({
    mutationFn: async (input: { password_actual: string; password_nueva: string }) => {
      await api.post('/auth/me/password/', input)
    },
  })
}

export interface EstadoWhatsApp {
  estado: 'conectado' | 'esperando_qr' | 'desconectado' | 'conectando' | 'no_configurado' | 'sin_conexion'
  qr: string | null
}

export function useEstadoWhatsApp() {
  return useQuery({
    queryKey: ['whatsapp-estado'],
    queryFn: async () => {
      const { data } = await api.get<EstadoWhatsApp>('/auth/whatsapp/estado/')
      return data
    },
    // Mientras se está vinculando conviene refrescar solo: el QR expira y el
    // estado cambia a "conectado" apenas el dueño escanea desde el celular.
    refetchInterval: (query) => (query.state.data?.estado === 'esperando_qr' ? 4000 : 15000),
  })
}

export function useDesconectarWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<EstadoWhatsApp>('/auth/whatsapp/desconectar/')
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-estado'] }),
  })
}

export function useDescargarRespaldo() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get('/auth/respaldo/', { responseType: 'blob' })
      const disposition = response.headers['content-disposition'] as string | undefined
      const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? 'respaldo.json'

      const url = URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}
