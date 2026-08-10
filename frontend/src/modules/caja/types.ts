export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CuentaPago {
  id: string
  nombre: string
  tipo: string
  comision_pct: string
  activo: boolean
}

export interface Contenedor {
  cuenta: string
  nombre: string
  tipo: string
  saldo_turno: string
}

export interface CajaSesion {
  id: string
  cajero: string | null
  cajero_nombre: string | null
  estado: 'abierta' | 'cerrada'
  monto_apertura: string
  monto_cierre: string | null
  monto_esperado: string | null
  diferencia: string | null
  fecha_apertura: string
  fecha_cierre: string | null
}

export interface CajaSesionActual extends CajaSesion {
  ventas_efectivo: string
  retiros: string
  contenedores: Contenedor[]
}

export type TipoMovimiento = 'ingreso' | 'egreso'

export interface CajaMovimiento {
  id: string
  sesion: string
  cuenta: string | null
  cuenta_nombre: string | null
  tipo: TipoMovimiento
  concepto: string
  monto: string
  transferencia_id: string | null
  created_at: string
}

export interface MovimientoInput {
  tipo: TipoMovimiento
  cuenta?: string | null
  concepto?: string
  monto: string
}

export interface TransferenciaInput {
  cuenta_origen: string
  cuenta_destino: string
  monto: string
  concepto?: string
}
