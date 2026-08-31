export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Categoria {
  id: string
  nombre: string
  orden: number
  activa: boolean
}

export interface Proveedor {
  id: string
  nombre: string
  cuit: string
  activo: boolean
}

export interface ProductoUniversal {
  id: string
  codigo_barras: string
  nombre: string
  descripcion: string
  categoria: string
  marca: string
  verificado: boolean
}

export interface Producto {
  id: string
  codigo_barras: string
  nombre: string
  descripcion: string
  categoria: string
  subcategoria: string
  proveedor: string | null
  proveedor_nombre: string | null
  precio_costo: string
  precio_venta: string
  margen_pct: number | null
  alicuota_iva: string
  stock: string
  stock_minimo: string
  stock_bajo: boolean
  venta_por_peso: boolean
  unidad_medida: string
  precio_bolsa: string | null
  bolsa_kg: string | null
  stock_en_bolsas: boolean
  precio_oferta: string | null
  oferta_activa: boolean
  modelo_nombre: string
  talle: string
  color: string
  /** Foto del producto. Vacío en la mayoría del catálogo: la galería de
   * aumentos cae a la inicial del nombre cuando no hay. */
  imagen_url: string
  destacado: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

export type ProductoInput = Partial<
  Omit<Producto, 'id' | 'margen_pct' | 'stock_bajo' | 'proveedor_nombre' | 'created_at' | 'updated_at'>
>

export interface ComboItem {
  id?: string
  producto: string
  cantidad: string
  // Sólo de lectura: los manda el backend para que el armador pueda mostrar el
  // precio suelto y el stock sin volver a pedir cada producto.
  producto_nombre?: string
  producto_precio_venta?: string
  producto_precio_costo?: string
  producto_stock?: string
  producto_unidad_medida?: string
}

export interface Combo {
  id: string
  nombre: string
  descripcion: string
  precio: string
  activo: boolean
  items: ComboItem[]
  /** Lo que costaría comprar lo mismo suelto. */
  precio_suelto: string
  costo: string
  /** Cuánto se le regala al cliente contra el suelto. Negativo = el pack sale
   * más caro que suelto, que casi siempre es un error de carga. */
  descuento_pct: number | null
  margen_pct: number | null
  /** Cuántos packs enteros salen del stock de hoy: manda el más escaso. */
  armables: number
}

export interface ComboInput {
  nombre: string
  descripcion?: string
  precio: string
  activo?: boolean
  items: { producto: string; cantidad: string }[]
}

export interface AjustePrecio {
  id: string
  descripcion: string
  tipo: 'porcentaje' | 'monto'
  valor: string
  filtro: { categoria: string | null; proveedor: string | null }
  aplicado_por: string | null
  cant_productos: number
  created_at: string
}

export interface AplicarAjusteInput {
  descripcion?: string
  tipo: 'porcentaje' | 'monto'
  /** Valor general. Negativo = descuento; no hay otro camino para eso. */
  valor: string
  categoria?: string
  proveedor?: string
  /** Selección explícita de la galería. Cuando viene, el backend la usa en
   * lugar del filtro de categoría/proveedor. `valor` por producto es opcional:
   * ausente = va con el general. */
  productos?: { producto: string; valor?: string }[]
}
