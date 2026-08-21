/** Turno del historial tal como lo maneja la API de Claude. El frontend no lo
 * interpreta: lo recibe, lo guarda y lo devuelve en el siguiente mensaje. */
export type TurnoApi = Record<string, unknown>

export interface AccionPendiente {
  id: string
  tipo: 'alta_producto' | 'venta'
  resumen: string
  estado: 'pendiente' | 'confirmada' | 'cancelada'
  created_at: string
}

export interface Cuota {
  limite_diario: number
  usadas_hoy: number
  restantes_hoy: number
  habilitado: boolean
  modelo: string
  consultas_periodo: number
  costo_periodo_usd: string
  costo_promedio_consulta_usd: string
}

export interface RespuestaConsulta {
  respuesta: string
  historial: TurnoApi[]
  accion_pendiente: AccionPendiente | null
  cuota: Cuota
}

export interface RespuestaConfirmacion {
  estado: 'confirmada' | 'cancelada'
  mensaje: string
}

/** Lo que se muestra en pantalla (distinto del historial que va a la API). */
export interface Burbuja {
  id: string
  autor: 'usuario' | 'asistente'
  texto: string
  accion?: AccionPendiente
}

export interface ModeloDisponible {
  id: string
  nombre: string
  detalle: string
}

export interface CuentaAsistente {
  tiene_key_propia: boolean
  key_enmascarada: string
  /** "comercio" = lo paga el cliente; "servidor" = lo paga quien administra. */
  factura: 'comercio' | 'servidor'
  modelo: string
  modelos_disponibles: ModeloDisponible[]
  consultas_diarias: number
}
