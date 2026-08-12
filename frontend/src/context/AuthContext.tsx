import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, comercioStorage, tokenStorage } from '../lib/api'
import { queryClient } from '../lib/queryClient'

interface Comercio {
  id: string
  nombre: string
  rubro: string
  logo_url: string
  bloqueado: boolean
}

interface Perfil {
  id: string
  nombre_completo: string
  rol: string
  email: string
  comercios: Comercio[]
}

interface AuthContextValue {
  user: Perfil | null
  comercio: Comercio | null
  comercios: Comercio[]
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setComercioActivo: (id: string) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [comercioActivoId, setComercioActivoId] = useState<string | null>(comercioStorage.id)

  async function fetchMe() {
    const { data } = await api.get<Perfil>('/auth/me/')
    setUser(data)
    if (!comercioStorage.id && data.comercios[0]) {
      comercioStorage.set(data.comercios[0].id)
      setComercioActivoId(data.comercios[0].id)
    }
  }

  useEffect(() => {
    if (!tokenStorage.access) {
      setLoading(false)
      return
    }
    fetchMe()
      .catch(() => {
        tokenStorage.clear()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    const { data } = await api.post('/auth/token/', { username, password })
    tokenStorage.set(data.access, data.refresh)
    await fetchMe()
  }

  function logout() {
    tokenStorage.clear()
    comercioStorage.clear()
    setUser(null)
    setComercioActivoId(null)
  }

  function setComercioActivo(id: string) {
    comercioStorage.set(id)
    setComercioActivoId(id)
    queryClient.clear()
  }

  const comercios = user?.comercios ?? []
  const comercio = comercios.find((c) => c.id === comercioActivoId) ?? comercios[0] ?? null

  return (
    <AuthContext.Provider value={{ user, comercio, comercios, loading, login, logout, setComercioActivo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
