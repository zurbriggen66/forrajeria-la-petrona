import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, comercioStorage, tokenStorage } from '../lib/api'
import { esColorValido, tintaSobre } from '../lib/color'
import { queryClient } from '../lib/queryClient'

interface Comercio {
  id: string
  nombre: string
  rubro: string
  logo_url: string
  bloqueado: boolean
  /** Color de marca elegido en Config. Vacío = el del tema. */
  color_acento: string
}

interface Perfil {
  id: string
  nombre_completo: string
  rol: string
  email: string
  username: string
  comercios: Comercio[]
  /** Módulos que el Dueño le apagó a este usuario en el comercio activo.
   * Opcional: un backend anterior a esta versión no manda el campo. */
  modulos_bloqueados?: string[]
}

interface AuthContextValue {
  user: Perfil | null
  comercio: Comercio | null
  comercios: Comercio[]
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setComercioActivo: (id: string) => void
  refrescarUsuario: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [comercioActivoId, setComercioActivoId] = useState<string | null>(comercioStorage.id)

  async function fetchMe() {
    const { data } = await api.get<Perfil>('/auth/me/')
    setUser(data)
    // La sucursal guardada puede haber quedado obsoleta (borrada, o el usuario
    // ya no la opera) — sin esto, el header X-Comercio-Id sigue mandando un id
    // inválido y el backend rechaza cada request con 403 para siempre.
    const sigueSiendoValida = data.comercios.some((c) => c.id === comercioStorage.id)
    if (!sigueSiendoValida && data.comercios[0]) {
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

  // El color de marca del comercio activo pisa la variable del tema en :root
  // (index.css la define en @theme), y con eso cambia de una todo lo que la
  // usa: botón principal, ítem activo del menú, foco de los campos, barras del
  // gráfico. Va acá y no en cada pantalla porque es una sola variable.
  useEffect(() => {
    const raiz = document.documentElement
    const color = comercio?.color_acento
    if (color && esColorValido(color)) {
      raiz.style.setProperty('--color-accent', color)
      // La tinta se calcula por contraste: con un acento claro (un amarillo),
      // la tinta oscura del tema dejaba el botón principal ilegible.
      raiz.style.setProperty('--color-accent-ink', tintaSobre(color))
    } else {
      // Sin color propio se saca el override y vuelve el del tema. Sacarlo
      // importa: al cambiar de sucursal, si no, quedaba el color de la anterior.
      raiz.style.removeProperty('--color-accent')
      raiz.style.removeProperty('--color-accent-ink')
    }
  }, [comercio?.color_acento])

  return (
    <AuthContext.Provider value={{ user, comercio, comercios, loading, login, logout, setComercioActivo, refrescarUsuario: fetchMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
