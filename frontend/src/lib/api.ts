import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
})

const ACCESS_KEY = 'kubo_access_token'
const REFRESH_KEY = 'kubo_refresh_token'
const COMERCIO_KEY = 'kubo_comercio_id'

export const tokenStorage = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// Sucursal activa (Fase 8): un usuario puede operar varios `Comercio`
// (una por sucursal) — el backend resuelve cuál usar por el header
// X-Comercio-Id (core/mixins.py::resolver_comercio_activo). Si el usuario
// opera una sola sucursal el header es innecesario y se omite.
export const comercioStorage = {
  get id() {
    return localStorage.getItem(COMERCIO_KEY)
  },
  set(id: string) {
    localStorage.setItem(COMERCIO_KEY, id)
  },
  clear() {
    localStorage.removeItem(COMERCIO_KEY)
  },
}

api.interceptors.request.use((config) => {
  const token = tokenStorage.access
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const comercioId = comercioStorage.id
  if (comercioId) {
    config.headers['X-Comercio-Id'] = comercioId
  }
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.refresh
  if (!refresh) return null
  try {
    const { data } = await axios.post(`${API_URL}/api/auth/token/refresh/`, { refresh })
    tokenStorage.set(data.access, refresh)
    return data.access as string
  } catch {
    tokenStorage.clear()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      refreshing ??= refreshAccessToken()
      const newAccess = await refreshing
      refreshing = null
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)
