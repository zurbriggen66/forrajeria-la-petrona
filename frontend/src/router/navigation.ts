import {
  Home, ShoppingCart, Package, TrendingUp, Warehouse, Tag, ClipboardList,
  FileText, BarChart3, Eye, Wallet,
  Store, UserCog, Truck, ShoppingBag, UserRound, Settings, Bike, Sparkles, Calculator,
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
  {
    label: 'Contabilidad', path: '/contabilidad', icon: Calculator,
    children: [
      { label: 'Resultado y caja', path: '/contabilidad/resultado' },
      { label: 'Mes a mes', path: '/contabilidad/mes-a-mes' },
      { label: 'Deudas', path: '/contabilidad/deudas' },
    ],
  },
  { label: 'Verdad del Negocio', path: '/verdad-del-negocio', icon: Eye },
  { label: 'Sucursales', path: '/sucursales', icon: Store },
  { label: 'Empleados', path: '/empleados', icon: UserCog },
  { label: 'Proveedores', path: '/proveedores', icon: Truck },
  {
    label: 'Compras', path: '/compras', icon: ShoppingBag,
    children: [
      { label: 'Registro de compras', path: '/compras/registro' },
      { label: 'Gastos variables', path: '/compras/gastos-variables' },
      { label: 'Gastos fijos', path: '/compras/gastos-fijos' },
      { label: 'Pedidos a proveedores', path: '/compras/pedidos' },
    ],
  },
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
// resuelva el título del módulo actual a partir del path. El padre de una
// sección también necesita ruta propia: al tocar su ícono en la barra se
// entra por ahí y SeccionPage abre la primera pestaña. Deduplicado por path
// por las dudas de que un padre repita el path de una hija.
const RUTAS_CON_DUPLICADOS = NAV_ITEMS.flatMap((item) => [
  { label: item.label, path: item.path },
  ...(item.children ?? []),
])
export const FLAT_ROUTES: { label: string; path: string }[] = [
  ...new Map(RUTAS_CON_DUPLICADOS.map((r) => [r.path, r])).values(),
]

/** Módulos que el Dueño puede apagar por empleado (Config > Usuarios).
 *
 * La clave es la ruta del menú, igual que en core/modulos.py del backend, así
 * que la misma lista sirve para esconder el ítem y para que el servidor corte
 * la request. Inicio y Config quedan afuera a propósito: sin Inicio el
 * empleado entra a una pantalla vacía, y en Config lo único que ve es su
 * propia cuenta y su contraseña. */
export const MODULOS_OPCIONALES = NAV_ITEMS.filter(
  (i) => i.path !== '/home' && i.path !== '/config',
)

/** ¿Esta ruta cae dentro de un módulo apagado? Contempla las hijas de una
 * sección: bloquear '/ventas' también bloquea '/ventas/historial'. */
export function moduloBloqueado(path: string, bloqueados: string[]) {
  return bloqueados.some((m) => path === m || path.startsWith(`${m}/`))
}
