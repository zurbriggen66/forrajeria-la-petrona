import {
  Home, ShoppingCart, Package, TrendingUp, Warehouse, Tag, ClipboardList,
  FileText, BarChart3, Eye, Wallet,
  Store, UserCog, Truck, PackageSearch, ShoppingBag, UserRound, Settings, Bike, Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  children?: { label: string; path: string }[]
}

// Orden y agrupación según ESPECIFICACION.md (sección 3 — navegación / mapa de módulos)
// y las capturas de referencia (capturas/__home.png).
export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', path: '/home', icon: Home },
  { label: 'Venta', path: '/pos', icon: ShoppingCart },
  { label: 'Asistente', path: '/asistente', icon: Sparkles },
  {
    label: 'Productos', path: '/productos', icon: Package,
    children: [
      { label: 'Listado de productos', path: '/productos/listado' },
      { label: 'Combos y Packs', path: '/productos/combos' },
      { label: 'Aumentos de precios', path: '/productos/aumentos' },
      { label: 'Historial de aumentos', path: '/productos/historial' },
    ],
  },
  { label: 'Stock', path: '/stock', icon: Warehouse },
  { label: 'Ranking Rentabilidad', path: '/inventario/ranking', icon: TrendingUp },
  { label: 'Etiquetas', path: '/etiquetas', icon: Tag },
  {
    label: 'Ventas', path: '/ventas', icon: ClipboardList,
    children: [
      { label: 'Historial de ventas', path: '/ventas/historial' },
      { label: 'Tickets', path: '/ventas/tickets' },
    ],
  },
  { label: 'Repartos', path: '/repartos', icon: Bike },
  { label: 'Presupuestos', path: '/presupuestos', icon: FileText },
  {
    label: 'Estadísticas', path: '/estadisticas', icon: BarChart3,
    children: [
      { label: 'Panel', path: '/estadisticas/panel' },
      { label: 'Rankings', path: '/estadisticas/rankings' },
      { label: 'Rentabilidad', path: '/estadisticas/rentabilidad' },
      { label: 'Mapa Neural', path: '/estadisticas/mapa-neural' },
    ],
  },
  { label: 'Verdad del Negocio', path: '/verdad-del-negocio', icon: Eye },
  {
    label: 'Finanzas', path: '/finanzas', icon: Wallet,
    children: [
      { label: 'Gastos', path: '/finanzas/gastos' },
    ],
  },
  { label: 'Sucursales', path: '/sucursales', icon: Store },
  { label: 'Empleados', path: '/empleados', icon: UserCog },
  { label: 'Proveedores', path: '/proveedores', icon: Truck },
  {
    label: 'Pedidos', path: '/pedidos', icon: PackageSearch,
    children: [
      { label: 'Sugeridos', path: '/pedidos/sugeridos' },
      { label: 'Manuales', path: '/pedidos/manuales' },
    ],
  },
  { label: 'Compras', path: '/compras', icon: ShoppingBag },
  {
    label: 'Caja', path: '/caja', icon: Wallet,
    children: [
      { label: 'Contenedores', path: '/caja/contenedores' },
      { label: 'Movimientos', path: '/caja/movimientos' },
      { label: 'Cuentas y Cajas', path: '/caja/cuentas-cajas' },
      { label: 'Historial sesiones', path: '/caja/historial' },
    ],
  },
  { label: 'Clientes', path: '/clientes', icon: UserRound },
  { label: 'Config', path: '/config', icon: Settings },
]

// Rutas planas (padres + hijas) para armar <Route> y para que el topbar
// resuelva el título del módulo actual a partir del path.
export const FLAT_ROUTES: { label: string; path: string }[] = NAV_ITEMS.flatMap((item) => [
  { label: item.label, path: item.path },
  ...(item.children ?? []),
])
