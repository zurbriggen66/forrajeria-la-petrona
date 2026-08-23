export interface Resumen {
  ingresos: string
  egresos: string
  balance: string
  margen_pct: number
  ticket_promedio: string
  cantidad_ventas: number
}

export interface TopProducto {
  producto: string | null
  nombre: string
  cantidad: string
  ingresos: string
}

export interface TopVendedor {
  vendedor: string | null
  nombre: string
  cantidad_ventas: number
  ingresos: string
}

export interface Rankings {
  top_productos: TopProducto[]
  top_vendedores: TopVendedor[]
}

export interface RentabilidadProducto {
  producto: string
  nombre: string
  categoria: string
  cantidad: string
  ingresos: string
  costo: string
  margen_pct: number
}

export interface RentabilidadCategoria {
  categoria: string
  ingresos: string
  costo: string
  margen_pct: number
}

export interface RentabilidadProveedor {
  proveedor: string | null
  nombre: string
  ingresos: string
  costo: string
  margen_pct: number
}

export interface RentabilidadHora {
  hora: number
  ingresos: string
  cantidad_ventas: number
}

export interface Periodo {
  desde: string
  hasta: string
  ingresos: string
  cantidad_ventas: number
}

export interface Comparativa {
  periodo_actual: Periodo
  periodo_anterior: Periodo
  variacion_ingresos_pct: number | null
  variacion_cantidad_pct: number | null
}

export interface VerdadDelNegocio {
  por_categoria: RentabilidadCategoria[]
  por_proveedor: RentabilidadProveedor[]
  por_hora: RentabilidadHora[]
  comparativa: Comparativa
}

export interface PanelKpis {
  ingresos: string
  egresos: string
  balance: string
  margen_pct: number
  ticket_promedio: string
  cantidad_ventas: number
  /** Plata quieta: stock a precio de costo de lo que no se vendió en el período. */
  capital_inmovilizado: string
  productos_sin_rotacion: number
  /** Variación vs el período anterior del mismo largo. Null si el anterior fue cero. */
  var_ingresos_pct: number | null
  var_egresos_pct: number | null
  var_balance_pct: number | null
  var_cantidad_pct: number | null
}

export interface PanelSerie {
  fecha: string
  ingresos: string
  egresos: string
  cantidad_ventas: number
  ticket_promedio: string
}

export interface MetodoPago {
  metodo: string
  monto: string
  pct: number
}

export interface TopCliente {
  cliente: string | null
  nombre: string
  ingresos: string
  cantidad_ventas: number
}

export interface Actividad {
  tipo: 'venta' | 'gasto' | 'pago_proveedor'
  descripcion: string
  detalle: string
  fecha: string
  monto: string
  /** 1 entra plata, -1 sale. */
  signo: number
}

export interface Panel {
  periodo: { desde: string; hasta: string }
  kpis: PanelKpis
  serie: PanelSerie[]
  metodos_pago: MetodoPago[]
  top_clientes: TopCliente[]
  por_hora: RentabilidadHora[]
  actividad: Actividad[]
}
