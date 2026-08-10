import { AlertTriangle, Loader2 } from 'lucide-react'
import { Table, type Column } from '../../components/ui/Table'
import { useAjustesPrecios } from './api'
import type { AjustePrecio } from './types'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function Historial() {
  const { data: ajustes, isLoading, isError } = useAjustesPrecios()

  const columns: Column<AjustePrecio>[] = [
    { header: 'Fecha', render: (a) => formatFecha(a.created_at) },
    { header: 'Descripción', render: (a) => a.descripcion || '—' },
    { header: 'Tipo', render: (a) => (a.tipo === 'porcentaje' ? `${a.valor}%` : `$ ${a.valor}`) },
    { header: 'Filtro', render: (a) => a.filtro?.categoria || (a.filtro?.proveedor ? 'Por proveedor' : 'Todos los productos') },
    { header: 'Productos afectados', render: (a) => a.cant_productos, className: 'tabular-nums' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando historial…
        </div>
      )}
      {isError && (
        <div className="flex flex-col items-center gap-2 py-16 text-danger">
          <AlertTriangle size={20} /> No se pudo cargar el historial.
        </div>
      )}
      {ajustes && (
        <Table columns={columns} rows={ajustes} rowKey={(a) => a.id} emptyMessage="Todavía no se aplicó ningún aumento de precios." />
      )}
    </div>
  )
}
