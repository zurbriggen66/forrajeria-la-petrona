export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const CONDICIONES_IVA = [
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'exento', label: 'Exento' },
] as const

/** Medios de pago que pueden disparar la facturación automática. Son los
 * `tipo` de CuentaPago, más el fiado, que no pasa por ninguna cuenta. */
export const MEDIOS_FACTURABLES = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cuenta_corriente', label: 'Cuenta corriente (fiado)' },
] as const

export interface FiscalConfig {
  id: string
  cuit: string
  razon_social: string
  punto_venta: string
  condicion_iva: string
  es_principal: boolean
  cert_ref: string
  homologacion: boolean
  activo: boolean
  facturar_automatico: boolean
  facturar_medios: string[]
  facturar_monto_minimo: string
}

export type FiscalConfigInput = Omit<FiscalConfig, 'id'>

export interface FiscalQueueItem {
  id: string
  venta: string
  venta_numero_ticket: number | null
  status: 'pendiente' | 'procesando' | 'ok' | 'error'
  cae: string
  cae_vencimiento: string | null
  punto_venta: string
  numero_factura: string
  tipo_comprobante: string
  error_msg: string
  created_at: string
}
