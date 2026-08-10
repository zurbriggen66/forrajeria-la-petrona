import { useState } from 'react'
import { ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { KpiCard } from '../../components/ui/KpiCard'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney } from '../../lib/format'
import { useCajaActual, useMovimientos } from './api'
import { AbrirCajaForm } from './AbrirCajaForm'
import { MovimientoFormModal } from './MovimientoFormModal'
import type { CajaMovimiento } from './types'

type Modo = 'ingreso' | 'egreso' | 'transferencia'

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export function Movimientos() {
  const { data: sesion, isLoading: cargandoSesion } = useCajaActual()
  const { data: movimientos, isLoading: cargandoMovimientos } = useMovimientos(sesion?.id)
  const [modal, setModal] = useState<Modo | null>(null)

  if (cargandoSesion) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Cargando caja…
      </div>
    )
  }

  if (!sesion) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-xl font-semibold text-text">Movimientos</h1>
        <AbrirCajaForm subtitle="Abrí la caja para poder registrar movimientos." />
      </div>
    )
  }

  const columns: Column<CajaMovimiento>[] = [
    { header: 'Hora', render: (m) => formatHora(m.created_at) },
    {
      header: 'Tipo',
      render: (m) => (
        <span className={`inline-flex items-center gap-1.5 ${m.tipo === 'ingreso' ? 'text-accent-2' : 'text-danger'}`}>
          {m.tipo === 'ingreso' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
          {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
          {m.transferencia_id && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-text-dim">Transf.</span>}
        </span>
      ),
    },
    { header: 'Contenedor', render: (m) => m.cuenta_nombre ?? '—' },
    {
      header: 'Monto',
      className: 'tabular-nums',
      render: (m) => (
        <span className={m.tipo === 'ingreso' ? 'text-accent-2' : 'text-danger'}>
          {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
        </span>
      ),
    },
    { header: 'Motivo', render: (m) => m.concepto || '—' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-text">Movimientos</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setModal('ingreso')}><ArrowUpCircle size={15} /> Ingresar Dinero</Button>
          <Button variant="secondary" onClick={() => setModal('egreso')}><ArrowDownCircle size={15} /> Retirar Dinero</Button>
          <Button variant="secondary" onClick={() => setModal('transferencia')}><ArrowLeftRight size={15} /> Transferir</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {sesion.contenedores.map((c) => (
          <KpiCard key={c.cuenta} label={c.nombre} value={formatMoney(c.saldo_turno)} subtitle="saldo del turno" />
        ))}
      </div>

      {cargandoMovimientos ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando movimientos…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={movimientos ?? []}
          rowKey={(m) => m.id}
          emptyMessage="Todavía no hay movimientos en este turno."
        />
      )}

      {modal && <MovimientoFormModal modo={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
