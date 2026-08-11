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
import { ControlCaja } from './modules/caja/ControlCaja'
import { Movimientos } from './modules/caja/Movimientos'
import { CuentasYCajas } from './modules/caja/CuentasYCajas'
import { HistorialSesiones } from './modules/caja/HistorialSesiones'
import { Gastos } from './modules/finanzas/Gastos'
import { HistorialVentas } from './modules/ventas/HistorialVentas'
import { Tickets } from './modules/ventas/Tickets'
import { Panel } from './modules/estadisticas/Panel'
import { Rankings } from './modules/estadisticas/Rankings'
import { Rentabilidad } from './modules/estadisticas/Rentabilidad'
import { VerdadDelNegocio } from './modules/estadisticas/VerdadDelNegocio'
import { Proveedores } from './modules/proveedores/Proveedores'
import { PedidosSugeridos } from './modules/proveedores/PedidosSugeridos'
import { PedidosManuales } from './modules/proveedores/PedidosManuales'
import { Compras } from './modules/compras/Compras'
import { Deposito } from './modules/inventario/Deposito'
import { Clientes } from './modules/clientes/Clientes'
import { Leads } from './modules/crm/Leads'

// Módulos ya implementados (ROADMAP Fases 1 a 6, sin Kubobots). El resto
// sigue como placeholder hasta que le toque su fase.
const MODULOS_IMPLEMENTADOS: Record<string, ComponentType> = {
  '/pos': PosPage,
  '/productos/listado': ProductosListado,
  '/productos/combos': Combos,
  '/productos/aumentos': Aumentos,
  '/productos/historial': Historial,
  '/inventario/stock': EstadoInventario,
  '/inventario/ranking': RankingRentabilidad,
  '/caja/contenedores': ControlCaja,
  '/caja/movimientos': Movimientos,
  '/caja/cuentas-cajas': CuentasYCajas,
  '/caja/historial': HistorialSesiones,
  '/finanzas/gastos': Gastos,
  '/ventas/historial': HistorialVentas,
  '/ventas/tickets': Tickets,
  '/estadisticas/panel': Panel,
  '/estadisticas/rankings': Rankings,
  '/estadisticas/rentabilidad': Rentabilidad,
  '/verdad-del-negocio': VerdadDelNegocio,
  '/proveedores': Proveedores,
  '/pedidos/sugeridos': PedidosSugeridos,
  '/pedidos/manuales': PedidosManuales,
  '/compras': Compras,
  '/deposito': Deposito,
  '/clientes': Clientes,
  '/crm': Leads,
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
