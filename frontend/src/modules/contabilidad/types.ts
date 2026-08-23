export interface Resultado {
  ingresos: string
  cmv: string
  margen_bruto: string
  margen_bruto_pct: number
  gastos_fijos: string
  gastos_variables: string
  gastos_totales: string
  resultado: string
}

export interface Flujo {
  cobrado_ventas: string
  cobros_cuenta_corriente: string
  entradas: string
  gastos: string
  pagos_proveedor: string
  salidas: string
  flujo_neto: string
}

/** Puente devengado → percibido:
 * flujo = resultado − fiado + cobros_cc + cmv − pagos_proveedor */
export interface Conciliacion {
  resultado: string
  ventas_fiadas: string
  cobros_cuenta_corriente: string
  cmv: string
  pagos_proveedor: string
  flujo_neto: string
}

export interface Equilibrio {
  alcanzable: boolean
  venta_necesaria: string
  venta_real: string
  diferencia: string
  margen_ratio_pct: number
}

export interface CategoriaRentabilidad {
  categoria: string
  ingresos: string
  costo: string
  margen: string
  margen_pct: number
  participacion_pct: number
}

export interface ResultadoContable {
  periodo: { desde: string; hasta: string }
  resultado: Resultado
  flujo: Flujo
  conciliacion: Conciliacion
  equilibrio: Equilibrio
  por_categoria: CategoriaRentabilidad[]
}

export interface MesContable {
  mes: string
  ingresos: string
  cmv: string
  margen_bruto: string
  gastos: string
  resultado: string
}

export interface Tramos {
  al_dia: string
  d31_60: string
  d61_90: string
  mas_90: string
}

export interface DeudorDetalle {
  id: string
  nombre: string
  saldo: string
  dias: number
  numero_factura?: string
  vencimiento?: string | null
}

export interface Deudas {
  fecha: string
  por_cobrar: { total: string; tramos: Tramos; detalle: DeudorDetalle[] }
  por_pagar: { total: string; tramos: Tramos; detalle: DeudorDetalle[] }
}
