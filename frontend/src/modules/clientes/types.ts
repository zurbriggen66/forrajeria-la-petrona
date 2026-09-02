export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  celular: string
  email: string
  cuit: string
  direccion: string
  tipo: string
  saldo_actual: string
  limite_credito: string
  kubobots_fid_off: boolean
  activo: boolean
}

export interface ClienteInput {
  nombre: string
  telefono: string
  celular: string
  email: string
  cuit: string
  direccion: string
  tipo: string
  limite_credito: string
  activo: boolean
}

export type TipoMovimientoCliente = 'cargo' | 'pago' | 'ajuste'
export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta'

export interface ClienteMovimiento {
  id: string
  cliente: string
  tipo: TipoMovimientoCliente
  monto: string
  referencia: string
  medio_pago: MedioPago | ''
  created_at: string
  /** En qué turno de caja entró la plata. null en un cargo o un ajuste (no
   * mueven plata) y en un pago cargado sin caja abierta. */
  caja_sesion: string | null
  cuenta_pago: string | null
  cuenta_pago_nombre: string | null
}

export interface ClienteMovimientoInput {
  tipo: 'pago' | 'ajuste'
  monto: string
  referencia?: string
  medio_pago?: MedioPago | ''
}

export interface ClienteAsignacion {
  id: string
  cliente: string
  vendedor: string | null
  vendedor_nombre: string | null
  activo: boolean
  created_at: string
}

/** Una edición o un borrado en la cuenta corriente de un cliente.
 *
 * Guarda copia de todo (nombre, montos, referencia) y no referencias: el
 * movimiento borrado ya no existe y el rastro tiene que seguir leyéndose. */
export interface MovimientoAuditoria {
  id: string
  cliente: string | null
  cliente_nombre: string
  accion: 'editado' | 'eliminado'
  motivo: string
  movimiento_id: string
  tipo: string
  monto_anterior: string
  referencia_anterior: string
  medio_pago_anterior: string
  /** null cuando la acción fue "eliminado". */
  monto_nuevo: string | null
  referencia_nueva: string
  medio_pago_nuevo: string
  saldo_anterior: string
  saldo_nuevo: string
  hecho_por: string | null
  hecho_por_nombre: string | null
  created_at: string
}

/** Una fila de ranking de clientes (los que más compran, los dormidos). */
export interface ClienteRanking {
  cliente: string
  nombre: string
  total: string
  cantidad: number
  ticket_promedio: string
  ultima_compra: string | null
}

export interface ClienteDeudor {
  cliente: string
  nombre: string
  saldo: string
  limite_credito: string
  /** Debe más que su límite de crédito. El límite es orientativo —el sistema
   * nunca bloquea una venta por esto— pero el dueño tiene que verlo. */
  paso_el_limite: boolean
}

export interface EstadisticasClientes {
  clientes: number
  con_deuda: number
  con_saldo_a_favor: number
  total_por_cobrar: string
  /** En positivo: es plata del cliente, no una deuda del comercio. */
  total_a_favor: string
  clientes_que_compraron: number
  facturado_a_clientes: string
  ticket_promedio: string
  dias_dormido: number
  top_compradores: ClienteRanking[]
  dormidos: ClienteRanking[]
  mayores_deudores: ClienteDeudor[]
}
