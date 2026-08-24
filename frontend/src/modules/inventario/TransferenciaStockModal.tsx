import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { ProductoPicker } from '../productos/ProductoPicker'
import type { Producto } from '../productos/types'
import { useDepositos, useStockDeposito, useTransferirStock, type Deposito } from './api'

export function TransferenciaStockModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const { data: depositos } = useDepositos()
  const transferir = useTransferirStock()

  const [producto, setProducto] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [origen, setOrigen] = useState('central')
  const [destino, setDestino] = useState('')

  const { data: stockOrigenDeposito } = useStockDeposito(origen !== 'central' ? origen : undefined)
  const disponible = !producto
    ? null
    : origen === 'central'
      ? Number(producto.stock)
      : Number(stockOrigenDeposito?.find((s) => s.producto === producto.id)?.stock ?? 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!producto) {
      toast('Elegí un producto', 'error')
      return
    }
    if (origen === destino) {
      toast('El origen y el destino no pueden ser el mismo', 'error')
      return
    }
    try {
      await transferir.mutateAsync({ producto: producto.id, cantidad, origen, destino })
      toast('Stock transferido')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo transferir el stock'), 'error')
    }
  }

  function opciones(excluir: string) {
    return (
      <>
        <option value="central" disabled={excluir === 'central'}>Local (central)</option>
        {depositos?.filter((d: Deposito) => d.id !== excluir).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </>
    )
  }

  return (
    <Modal title="Transferir stock" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-dim">Producto</label>
          <ProductoPicker producto={producto} onSelect={setProducto} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select id="origen" label="Desde" value={origen} onChange={(e) => setOrigen(e.target.value)}>
            {opciones(destino)}
          </Select>
          <Select id="destino" label="Hacia" required value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Elegí destino…</option>
            {opciones(origen)}
          </Select>
        </div>
        {disponible !== null && (
          <p className="text-xs text-text-dim">Disponible en el origen: <span className="font-medium text-text">{disponible}</span></p>
        )}
        <Input id="cantidad" label="Cantidad" type="number" min="0.001" step="any" required value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={transferir.isPending}>
            {transferir.isPending && <Loader2 size={14} className="animate-spin" />}
            Transferir
          </Button>
        </div>
      </form>
    </Modal>
  )
}
