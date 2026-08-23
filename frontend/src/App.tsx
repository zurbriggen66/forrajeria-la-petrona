import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { RequireAuth } from './router/RequireAuth'
import { ShellLayout } from './shell/ShellLayout'
import { LoginPage } from './pages/LoginPage'
import { ModulePlaceholder } from './modules/ModulePlaceholder'
import { FLAT_ROUTES, NAV_ITEMS } from './router/navigation'
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
              return <Route key={route.path} path={route.path} element={elemento} />
            })}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
