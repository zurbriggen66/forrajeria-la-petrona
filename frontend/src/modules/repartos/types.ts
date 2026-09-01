export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type EstadoReparto = 'pendiente' | 'en_camino' | 'entregado' | 'cancelado'

export const ESTADOS: { value: EstadoReparto; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_camino', label: 'En camino' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export interface RepartoItem {
  id: string
  producto: string | null
  producto_nombre: string | null
  unidad_medida: string | null
  bolsa_kg: string | null
  cantidad: string
  es_bolsa: boolean
  /** El precio congelado al cargar el reparto. */
  precio_unitario: string
  subtotal: string
  /** Los precios VIGENTES del producto. Los necesita el formulario de edición
   * para recalcular la línea al cambiar la cantidad o pasar de suelto a bolsa;
   * `precio_unitario` es el de aquel día y no sirve para eso. */
  producto_precio_venta: string | null
  producto_precio_bolsa: string | null
}

export interface Reparto {
  id: string
  cliente: string | null
  cliente_registrado_nombre: string | null
  cliente_nombre: string
  telefono: string
  destino: string
  fecha: string
  estado: EstadoReparto
  repartidor: string | null
  repartidor_nombre: string | null
  notas: string
  /** Con qué se va a cobrar. null + a_cuenta_corriente false = sin definir. */
  cuenta_pago: string | null
  cuenta_pago_nombre: string | null
  /** Va a la cuenta del cliente: el repartidor no cobra nada. */
  a_cuenta_corriente: boolean
  subtotal: string
  costo_envio: string
  descuento: string
  total: string
  items: RepartoItem[]
  created_at: string
  /** Venta que salió de facturar este reparto. null = todavía no se facturó,
   * así que no descontó stock ni entró a caja. */
  venta: string | null
  venta_numero_ticket: number | null
}

export interface RepartoItemInput {
  producto: string
  cantidad: string
  es_bolsa: boolean
}

export interface RepartoInput {
  cliente?: string | null
  cliente_nombre: string
  telefono?: string
  destino: string
  fecha: string
  estado?: EstadoReparto
  notas?: string
  cuenta_pago?: string | null
  a_cuenta_corriente?: boolean
  costo_envio: string
  descuento: string
  items: RepartoItemInput[]
}

export interface RepartoFiltros {
  estado?: EstadoReparto
  fecha_desde?: string
  fecha_hasta?: string
  search?: string
}
