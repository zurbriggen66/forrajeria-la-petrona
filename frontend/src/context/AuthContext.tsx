import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStorage } from '../lib/api'

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
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchMe() {
    const { data } = await api.get<Perfil>('/auth/me/')
    setUser(data)
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
    setUser(null)
  }

  const comercio = user?.comercios[0] ?? null

  return (
    <AuthContext.Provider value={{ user, comercio, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
