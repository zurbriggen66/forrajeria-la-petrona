import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { RequireAuth } from './router/RequireAuth'
import { ShellLayout } from './shell/ShellLayout'
import { LoginPage } from './pages/LoginPage'
import { ModulePlaceholder } from './modules/ModulePlaceholder'
import { FLAT_ROUTES, moduloBloqueado, NAV_ITEMS } from './router/navigation'
import { MODULOS_IMPLEMENTADOS } from './router/modulos'
import { SeccionPage } from './router/SeccionPage'

/** Paths que pertenecen a una sección con pestañas (el padre y cada hija).
 * Todos rinden SeccionPage: así la pestaña activa sale de la URL y la barra
 * de pestañas no desaparece al navegar entre ellas. */
const RUTAS_DE_SECCION = new Set(
  NAV_ITEMS.filter((i) => i.children?.length).flatMap((i) => [
    i.path,
    ...i.children!.map((c) => c.path),
  ]),
)

/** Una ruta de un módulo apagado manda al inicio en vez de renderizar.
 * Esconder el ítem del menú no alcanza: la URL se puede escribir a mano. */
function RutaDeModulo({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useAuth()
  if (moduloBloqueado(path, user?.modulos_bloqueados ?? [])) {
    return <Navigate to="/home" replace />
  }
  return children
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAuth>
                <ShellLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/home" replace />} />
            {FLAT_ROUTES.map((route) => {
              const Modulo = MODULOS_IMPLEMENTADOS[route.path]
              const elemento = RUTAS_DE_SECCION.has(route.path)
                ? <SeccionPage />
                : Modulo
                  ? <Modulo />
                  : <ModulePlaceholder nombre={route.label} />
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<RutaDeModulo path={route.path}>{elemento}</RutaDeModulo>}
                />
              )
            })}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
