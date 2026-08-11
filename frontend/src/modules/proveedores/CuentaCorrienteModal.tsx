import { useState } from 'react'
import { ArrowDownCircle, Loader2, SlidersHorizontal } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { formatMoney } from '../../lib/format'
import { useMovimientosProveedor } from './api'
import { MovimientoProveedorFormModal } from './MovimientoProveedorFormModal'
import type { Proveedor } from './types'

const ETIQUETA_TIPO: Record<string, string> = { compra: 'Compra', pago: 'Pago', ajuste: 'Ajuste' }

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function CuentaCorrienteModal({ proveedor, onClose }: { proveedor: Proveedor; onClose: () => void }) {
  const { data: movimientos, isLoading } = useMovimientosProveedor(proveedor.id)
  const [modal, setModal] = useState<'pago' | 'ajuste' | null>(null)

  const saldo = Number(proveedor.saldo_actual)

  return (
    <Modal title={`Cuenta corriente — ${proveedor.nombre}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-dim">Saldo actual</p>
            <p className={`font-display text-2xl font-semibold tabular-nums ${saldo > 0 ? 'text-danger' : saldo < 0 ? 'text-accent-2' : 'text-text'}`}>
              {formatMoney(proveedor.saldo_actual)}
            </p>
            <p className="mt-0.5 text-xs text-text-dim">{saldo > 0 ? 'Le debemos al proveedor' : saldo < 0 ? 'El proveedor nos debe' : 'Sin deuda pendiente'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModal('pago')}><ArrowDownCircle size={15} /> Registrar pago</Button>
            <Button variant="ghost" onClick={() => setModal('ajuste')}><SlidersHorizontal size={15} /> Ajuste</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-text-dim">
            <Loader2 size={16} className="animate-spin" /> Cargando movimientos…
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-dim">Fecha</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-dim">Tipo</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-dim">Referencia</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-dim">Monto</th>
                </tr>
              </thead>
              <tbody>
                {(movimientos ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-text-dim">Todavía no hay movimientos.</td></tr>
                ) : (
                  movimientos!.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-text-dim">{formatFecha(m.created_at)}</td>
                      <td className="px-3 py-2">{ETIQUETA_TIPO[m.tipo] ?? m.tipo}</td>
                      <td className="px-3 py-2 text-text-dim">{m.referencia || '—'}</td>
                      <td className={`px-3 py-2 tabular-nums ${m.tipo === 'pago' ? 'text-accent-2' : 'text-text'}`}>
                        {m.tipo === 'pago' ? '-' : '+'}{formatMoney(m.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <MovimientoProveedorFormModal proveedorId={proveedor.id} tipo={modal} onClose={() => setModal(null)} />
      )}
    </Modal>
  )
}
