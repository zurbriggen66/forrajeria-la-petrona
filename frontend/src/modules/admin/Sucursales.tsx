import { useState } from 'react'
import { Loader2, Plus, Store } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatMoney } from '../../lib/format'
import { ErrorLogsPanel } from './ErrorLogsPanel'
import { SucursalFormModal } from './SucursalFormModal'
import { useSucursales } from './api'
import type { Sucursal } from './types'

export function Sucursales() {
  const { comercio, setComercioActivo } = useAuth()
  const { toast } = useToast()
  const { data: sucursales, isLoading } = useSucursales()
  const [modalSucursal, setModalSucursal] = useState<Sucursal | 'nueva' | null>(null)

  const columns: Column<Sucursal>[] = [
    {
      header: 'Sucursal',
      render: (s) => (
        <span className="flex items-center gap-2 font-medium">
          <Store size={14} className="text-accent" />
          {s.nombre}
          {s.id === comercio?.id && (
            <span className="rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase text-accent">Activa</span>
          )}
        </span>
      ),
    },
    { header: 'Ventas hoy', render: (s) => formatMoney(s.ventas_hoy), className: 'tabular-nums' },
    {
      header: 'Caja',
      render: (s) => (
        <span className={`rounded-full border px-2 py-0.5 text-xs ${s.caja_abierta ? 'border-accent-2/40 text-accent-2' : 'border-border text-text-dim'}`}>
          {s.caja_abierta ? 'Abierta' : 'Cerrada'}
        </span>
      ),
    },
    { header: 'Alertas', render: (s) => (s.alertas_count > 0 ? <span className="text-warning">{s.alertas_count}</span> : '—') },
    {
      header: 'Acciones',
      render: (s) => (
        <div className="flex items-center gap-2">
          {s.id !== comercio?.id && (
            <Button
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                setComercioActivo(s.id)
                toast(`Ahora estás operando ${s.nombre}`)
              }}
            >
              Operar acá
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-dim">Comparativo de tus sucursales. Elegí una fila para operar en esa sucursal.</p>
          <Button onClick={() => setModalSucursal('nueva')}><Plus size={15} /> Nueva sucursal</Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
            <Loader2 size={16} className="animate-spin" /> Cargando sucursales…
          </div>
        ) : (
          <Table
            columns={columns}
            rows={sucursales ?? []}
            rowKey={(s) => s.id}
            emptyMessage="Todavía no hay sucursales cargadas."
            onRowClick={(s) => setModalSucursal(s)}
          />
        )}
      </div>

      <ErrorLogsPanel />

      {modalSucursal && (
        <SucursalFormModal
          sucursal={modalSucursal === 'nueva' ? undefined : modalSucursal}
          onClose={() => setModalSucursal(null)}
        />
      )}
    </div>
  )
}
