import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useProveedores } from '../proveedores/api'
import type { CompraFiltros } from './types'

interface Props {
  value: CompraFiltros
  onChange: (next: CompraFiltros) => void
}

export function CompraFiltrosBar({ value, onChange }: Props) {
  const { data: proveedores } = useProveedores()

  function set<K extends keyof CompraFiltros>(key: K, val: CompraFiltros[K]) {
    onChange({ ...value, [key]: val || undefined })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <Input
        id="cf-desde" label="Desde" type="date"
        value={value.fecha_desde ?? ''} onChange={(e) => set('fecha_desde', e.target.value)}
      />
      <Input
        id="cf-hasta" label="Hasta" type="date"
        value={value.fecha_hasta ?? ''} onChange={(e) => set('fecha_hasta', e.target.value)}
      />
      <Select id="cf-proveedor" label="Proveedor" value={value.proveedor ?? ''} onChange={(e) => set('proveedor', e.target.value)}>
        <option value="">Todos</option>
        {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </Select>
      <Select
        id="cf-estado" label="Estado"
        value={value.pagado === undefined ? '' : String(value.pagado)}
        onChange={(e) => onChange({ ...value, pagado: e.target.value === '' ? undefined : e.target.value === 'true' })}
      >
        <option value="">Todas</option>
        <option value="true">Pagadas</option>
        <option value="false">Pendientes</option>
      </Select>
    </div>
  )
}
