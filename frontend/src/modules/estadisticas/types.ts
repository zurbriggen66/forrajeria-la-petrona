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
