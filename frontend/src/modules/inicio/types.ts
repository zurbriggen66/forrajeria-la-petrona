/** Payload de GET /estadisticas/inicio/. La plata viaja como string (decimales
 * de DRF); los conteos como number. Lo que el rol no puede ver llega en null:
 * el backend directamente no lo calcula. */

export interface InicioDia {
  ingresos: string
  cantidad_ventas: number
  ticket_promedio: string
  /** null para roles sin acceso a la plata del negocio (Cajero / Repositor). */
  egresos: string | null
  balance: string | null
}

export interface InicioComparacion {
  /** null cuando ayer no tuvo ventas — mostrar "—", nunca un porcentaje. */
  variacion_ingresos_pct: number | null
  variacion_cantidad_pct: number | null
  promedio_diario_7d: string
}

export interface InicioDiaSerie {
  fecha: string
  ingresos: string
  cantidad_ventas: number
}

export interface InicioPendientes {
  repartos_hoy: number
  repartos_pendientes: number
  presupuestos_pendientes: number
  stock_bajo: number
  sin_stock: number
  pedidos_sugeridos: number
  /** Compras fiadas sin saldar, y cuántas de ésas ya vencieron. */
  facturas_por_pagar: number
  facturas_vencidas: number
}

export interface Deudor {
  id: string
  nombre: string
  saldo_actual: string
}

export interface InicioDeudas {
  total_por_cobrar: string
  top_deudores: Deudor[]
  total_por_pagar: string
}

export interface TopProductoHoy {
  producto: string | null
  nombre: string
  cantidad: string
  ingresos: string
}

export interface Inicio {
  fecha: string
  hoy: InicioDia
  ayer: InicioDia
  comparacion: InicioComparacion
  serie_7dias: InicioDiaSerie[]
  pendientes: InicioPendientes
  /** null para roles sin acceso a la plata del negocio. */
  deudas: InicioDeudas | null
  top_productos_hoy: TopProductoHoy[]
}
