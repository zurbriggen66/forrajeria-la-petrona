import type { ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { RequireAuth } from './router/RequireAuth'
import { ShellLayout } from './shell/ShellLayout'
import { LoginPage } from './pages/LoginPage'
import { ModulePlaceholder } from './modules/ModulePlaceholder'
import { FLAT_ROUTES } from './router/navigation'
import { ProductosListado } from './modules/productos/ProductosListado'
import { Combos } from './modules/productos/Combos'
import { Aumentos } from './modules/productos/Aumentos'
import { Historial } from './modules/productos/Historial'
import { EstadoInventario } from './modules/inventario/EstadoInventario'
import { RankingRentabilidad } from './modules/inventario/RankingRentabilidad'
import { PosPage } from './modules/pos/PosPage'

// Módulos ya implementados (ROADMAP Fases 1 y 2). El resto sigue como
// placeholder hasta que le toque su fase.
const MODULOS_IMPLEMENTADOS: Record<string, ComponentType> = {
  '/pos': PosPage,
  '/productos/listado': ProductosListado,
  '/productos/combos': Combos,
  '/productos/aumentos': Aumentos,
  '/productos/historial': Historial,
  '/inventario/stock': EstadoInventario,
  '/inventario/ranking': RankingRentabilidad,
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
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={Modulo ? <Modulo /> : <ModulePlaceholder nombre={route.label} />}
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
