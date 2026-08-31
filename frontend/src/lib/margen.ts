/** Margen SOBRE EL PRECIO DE VENTA — la convención de todo el sistema
 * (backend/productos/serializers.py::get_margen_pct, y lo que muestran el
 * listado de productos, Rentabilidad y los rankings).
 *
 * No confundir con markup sobre el costo: con costo $100 y venta $200 el
 * margen acá es 50%, no 100%. Usar la otra fórmula haría que el número del
 * formulario de compra no coincida con el que el dueño ve en el resto de las
 * pantallas, que es peor que no mostrarlo.
 */
export function margenDesdePrecio(costo: number, precioVenta: number): number | null {
  if (!Number.isFinite(costo) || !Number.isFinite(precioVenta) || precioVenta <= 0) return null
  return ((precioVenta - costo) / precioVenta) * 100
}

/** Precio de venta que deja ese margen. null cuando no es alcanzable: al 100%
 * el precio se iría a infinito, y por arriba de 100% daría negativo. */
export function precioDesdeMargen(costo: number, margenPct: number): number | null {
  if (!Number.isFinite(costo) || !Number.isFinite(margenPct) || margenPct >= 100) return null
  const precio = costo / (1 - margenPct / 100)
  return Number.isFinite(precio) ? precio : null
}

export function redondearCentavos(valor: number) {
  return Math.round(valor * 100) / 100
}
