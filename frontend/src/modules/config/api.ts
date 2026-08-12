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
