import { useState } from 'react'
import { ArrowLeftRight, Loader2, Plus, Warehouse } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Table, type Column } from '../../components/ui/Table'
import { DepositoFormModal } from './DepositoFormModal'
import { TransferenciaStockModal } from './TransferenciaStockModal'
import { useDepositos, useStockDeposito, type StockDeposito } from './api'

export function Deposito() {
  const { data: depositos, isLoading: cargandoDepositos } = useDepositos()
  const [depositoId, setDepositoId] = useState('')
  const { data: stock, isLoading: cargandoStock } = useStockDeposito(depositoId || undefined)
  const [showDepositoForm, setShowDepositoForm] = useState(false)
  const [showTransferir, setShowTransferir] = useState(false)

  const columns: Column<StockDeposito>[] = [
    { header: 'Depósito', render: (s) => s.deposito_nombre },
    { header: 'Producto', render: (s) => s.producto_nombre },
    { header: 'Stock', render: (s) => s.stock, className: 'tabular-nums' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">Stock guardado fuera del local, por depósito.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowTransferir(true)}><ArrowLeftRight size={15} /> Transferir stock</Button>
          <Button onClick={() => setShowDepositoForm(true)}><Plus size={15} /> Nuevo depósito</Button>
        </div>
      </div>

      {cargandoDepositos ? (
        <div className="flex items-center justify-center gap-2 py-10 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando depósitos…
        </div>
      ) : (depositos ?? []).length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-dim">
          Todavía no cargaste ningún depósito.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {depositos!.map((d) => (
            <div key={d.id} className="tarjeta-viva rounded-xl border border-border bg-surface p-4">
              <div className="mb-1 flex items-center gap-2 text-accent">
                <Warehouse size={15} />
                <span className="font-medium text-text">{d.nombre}</span>
              </div>
              <p className="text-xs text-text-dim">{d.direccion || 'Sin dirección'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-text">Stock por depósito</h2>
        <Select value={depositoId} onChange={(e) => setDepositoId(e.target.value)} className="w-56">
          <option value="">Todos los depósitos</option>
          {depositos?.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </Select>
      </div>

      {cargandoStock ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando stock…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={(stock ?? []).filter((s) => Number(s.stock) > 0)}
          rowKey={(s) => s.id}
          emptyMessage="Sin stock transferido a depósitos todavía."
        />
      )}

      {showDepositoForm && <DepositoFormModal onClose={() => setShowDepositoForm(false)} />}
      {showTransferir && <TransferenciaStockModal onClose={() => setShowTransferir(false)} />}
    </div>
  )
}
