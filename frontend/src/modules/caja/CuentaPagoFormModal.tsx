import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCreateCuentaPago, useUpdateCuentaPago } from './api'
import type { CuentaPago } from './types'

const TIPOS = ['efectivo', 'tarjeta', 'banco', 'transferencia', 'billetera_virtual', 'otro']

export function CuentaPagoFormModal({ cuenta, onClose }: { cuenta: CuentaPago | null; onClose: () => void }) {
  const { toast } = useToast()
  const createCuenta = useCreateCuentaPago()
  const updateCuenta = useUpdateCuentaPago()

  const [nombre, setNombre] = useState(cuenta?.nombre ?? '')
  const [tipo, setTipo] = useState(cuenta?.tipo ?? 'efectivo')
  const [comisionPct, setComisionPct] = useState(cuenta?.comision_pct ?? '0')
  const [activo, setActivo] = useState(cuenta?.activo ?? true)

  const pendiente = createCuenta.isPending || updateCuenta.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = { nombre, tipo, comision_pct: comisionPct, activo }
    try {
      if (cuenta) {
        await updateCuenta.mutateAsync({ id: cuenta.id, input })
      } else {
        await createCuenta.mutateAsync(input)
      }
      toast(cuenta ? 'Contenedor actualizado' : 'Contenedor creado')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el contenedor'), 'error')
    }
  }

  return (
    <Modal title={cuenta ? 'Editar contenedor' : 'Nuevo contenedor'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="nombre" label="Nombre" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Select id="tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input
          id="comision" label="Comisión %" type="number" min="0" step="0.01"
          value={comisionPct} onChange={(e) => setComisionPct(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-text-dim">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activo
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pendiente}>
            {pendiente && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
