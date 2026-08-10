import { Select } from '../../components/ui/Select'
import { Input } from '../../components/ui/Input'
import { useCategorias, useProveedores } from '../productos/api'
import { useCuentasPago } from '../caja/api'
import { useVendedores } from './api'
import type { VentasFiltros } from './types'

interface Props {
  value: VentasFiltros
  onChange: (next: VentasFiltros) => void
}

/** Filtros comunes al Historial de ventas y al panel de Estadísticas / Verdad
 * del Negocio: fechas, vendedor, categoría, proveedor y método de pago. */
export function FiltrosBar({ value, onChange }: Props) {
  const { data: categorias } = useCategorias()
  const { data: proveedores } = useProveedores()
  const { data: cuentas } = useCuentasPago(true)
  const { data: vendedores } = useVendedores()

  function set<K extends keyof VentasFiltros>(key: K, val: VentasFiltros[K]) {
    onChange({ ...value, [key]: val || undefined })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <Input
        id="f-desde" label="Desde" type="date"
        value={value.fecha_desde ?? ''} onChange={(e) => set('fecha_desde', e.target.value)}
      />
      <Input
        id="f-hasta" label="Hasta" type="date"
        value={value.fecha_hasta ?? ''} onChange={(e) => set('fecha_hasta', e.target.value)}
      />
      <Select id="f-vendedor" label="Vendedor" value={value.vendedor ?? ''} onChange={(e) => set('vendedor', e.target.value)}>
        <option value="">Todos</option>
        {vendedores?.map((v) => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
      </Select>
      <Select id="f-categoria" label="Categoría" value={value.categoria ?? ''} onChange={(e) => set('categoria', e.target.value)}>
        <option value="">Todas</option>
        {categorias?.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
      </Select>
      <Select id="f-proveedor" label="Proveedor" value={value.proveedor ?? ''} onChange={(e) => set('proveedor', e.target.value)}>
        <option value="">Todos</option>
        {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </Select>
      <Select id="f-cuenta" label="Método de pago" value={value.cuenta_pago ?? ''} onChange={(e) => set('cuenta_pago', e.target.value)}>
        <option value="">Todos</option>
        {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </Select>
    </div>
  )
}
