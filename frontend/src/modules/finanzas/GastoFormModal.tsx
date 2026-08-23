import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCuentasPago } from '../caja/api'
import { useCreateGasto } from './api'
import type { TipoGasto } from './types'

const CATEGORIAS = ['Insumos', 'Servicios', 'Sueldos', 'Proveedores', 'Alquiler', 'Impuestos', 'Otros']

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export function GastoFormModal({ tipoInicial, onClose }: { tipoInicial: TipoGasto; onClose: () => void }) {
  const { toast } = useToast()
  const { data: cuentas } = useCuentasPago(true)
  const createGasto = useCreateGasto()

  const [tipo, setTipo] = useState<TipoGasto>(tipoInicial)
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [cuentaId, setCuentaId] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createGasto.mutateAsync({ tipo, categoria, descripcion, monto, fecha, cuenta_id: cuentaId || null })
      toast('Gasto registrado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo registrar el gasto'), 'error')
    }
  }

  return (
    <Modal title={tipo === 'fijo' ? 'Nuevo gasto fijo' : 'Nuevo gasto variable'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Select id="tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoGasto)}>
            <option value="fijo">Fijo (se repite mes a mes)</option>
            <option value="variable">Variable</option>
          </Select>
          <Input id="fecha" label="Fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <Select id="categoria" label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input id="descripcion" label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Pago a proveedor" />
        <div className="grid grid-cols-2 gap-4">
          <Input id="monto" label="Monto" type="number" min="0.01" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} />
          <Select id="cuenta" label="Pagado desde" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Efectivo (por defecto)</option>
            {cuentas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </div>
        <p className="text-xs text-text-dim">
          Si hay una caja abierta, este gasto se descuenta automáticamente del contenedor elegido.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createGasto.isPending}>
            {createGasto.isPending && <Loader2 size={14} className="animate-spin" />}
            Registrar gasto
          </Button>
        </div>
      </form>
    </Modal>
  )
}
