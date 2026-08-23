import type { ComponentType } from 'react'
import { Inicio } from '../modules/inicio/Inicio'
import { ProductosListado } from '../modules/productos/ProductosListado'
import { Combos } from '../modules/productos/Combos'
import { Aumentos } from '../modules/productos/Aumentos'
import { Historial } from '../modules/productos/Historial'
import { Stock } from '../modules/inventario/Stock'
import { RankingRentabilidad } from '../modules/inventario/RankingRentabilidad'
import { PosPage } from '../modules/pos/PosPage'
import { ControlCaja } from '../modules/caja/ControlCaja'
import { Movimientos } from '../modules/caja/Movimientos'
import { CuentasYCajas } from '../modules/caja/CuentasYCajas'
import { HistorialSesiones } from '../modules/caja/HistorialSesiones'
import { HistorialVentas } from '../modules/ventas/HistorialVentas'
import { Tickets } from '../modules/ventas/Tickets'
import { Panel } from '../modules/estadisticas/Panel'
import { Rankings } from '../modules/estadisticas/Rankings'
import { Rentabilidad } from '../modules/estadisticas/Rentabilidad'
import { VerdadDelNegocio } from '../modules/estadisticas/VerdadDelNegocio'
import { Resultado } from '../modules/contabilidad/Resultado'
import { MesAMes } from '../modules/contabilidad/MesAMes'
import { DeudasAging } from '../modules/contabilidad/DeudasAging'
import { Proveedores } from '../modules/proveedores/Proveedores'
import { Compras } from '../modules/compras/Compras'
import { PedidosProveedorTab } from '../modules/compras/PedidosProveedorTab'
import { GastosFijos, GastosVariables } from '../modules/finanzas/Gastos'
import { Repartos } from '../modules/repartos/Repartos'
import { Presupuestos } from '../modules/presupuestos/Presupuestos'
import { Asistente } from '../modules/asistente/Asistente'
import { Clientes } from '../modules/clientes/Clientes'
import { Sucursales } from '../modules/admin/Sucursales'
import { Turnos } from '../modules/empleados/Turnos'
import { Etiquetas } from '../modules/etiquetas/Etiquetas'
import { Config } from '../modules/config/Config'

/** Qué componente rinde cada ruta. Vive acá y no en App.tsx porque también lo
 * necesita SeccionPage para resolver la pestaña activa de una sección; si
 * siguiera en App.tsx el import sería circular.
 *
 * Lo que no figure acá cae en <ModulePlaceholder> (Mapa Neural, Kubobots…). */
export const MODULOS_IMPLEMENTADOS: Record<string, ComponentType> = {
  '/home': Inicio,
  '/pos': PosPage,
  '/asistente': Asistente,
  '/productos/listado': ProductosListado,
  '/productos/combos': Combos,
  '/productos/aumentos': Aumentos,
  '/productos/historial': Historial,
  '/stock': Stock,
  '/inventario/ranking': RankingRentabilidad,
  '/caja/contenedores': ControlCaja,
  '/caja/movimientos': Movimientos,
  '/caja/cuentas-cajas': CuentasYCajas,
  '/caja/historial': HistorialSesiones,
  '/ventas/historial': HistorialVentas,
  '/ventas/tickets': Tickets,
  '/estadisticas/panel': Panel,
  '/estadisticas/rankings': Rankings,
  '/estadisticas/rentabilidad': Rentabilidad,
  '/verdad-del-negocio': VerdadDelNegocio,
  '/contabilidad/resultado': Resultado,
  '/contabilidad/mes-a-mes': MesAMes,
  '/contabilidad/deudas': DeudasAging,
  '/proveedores': Proveedores,
  '/compras/registro': Compras,
  '/compras/gastos-variables': GastosVariables,
  '/compras/gastos-fijos': GastosFijos,
  '/compras/pedidos': PedidosProveedorTab,
  '/repartos': Repartos,
  '/presupuestos': Presupuestos,
  '/clientes': Clientes,
  '/sucursales': Sucursales,
  '/empleados': Turnos,
  '/etiquetas': Etiquetas,
  '/config': Config,
}
