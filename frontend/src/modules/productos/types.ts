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
  plu_balanza: string
  precio_oferta: string | null
  oferta_activa: boolean
  modelo_nombre: string
  talle: string
  color: string
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
  producto_nombre?: string
  cantidad: string
}

export interface Combo {
  id: string
  nombre: string
  descripcion: string
  precio: string
  activo: boolean
  items: ComboItem[]
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
  valor: string
  categoria?: string
  proveedor?: string
}
