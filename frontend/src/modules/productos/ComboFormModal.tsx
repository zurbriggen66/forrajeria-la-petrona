import { useState, type FormEvent } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { useCreateCombo, useProductos } from './api'

interface Row {
  producto: string
  cantidad: string
}

export function ComboFormModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const { data: productos } = useProductos({ ordering: 'nombre' })
  const createCombo = useCreateCombo()

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('0')
  const [items, setItems] = useState<Row[]>([{ producto: '', cantidad: '1' }])

  function updateItem(index: number, patch: Partial<Row>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setItems((prev) => [...prev, { producto: '', cantidad: '1' }])
  }

  function removeRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validItems = items.filter((i) => i.producto)
    if (validItems.length === 0) {
      toast('Agregá al menos un producto al combo', 'error')
      return
    }
    try {
      await createCombo.mutateAsync({ nombre, descripcion, precio, items: validItems })
      toast('Combo creado')
      onClose()
    } catch {
      toast('No se pudo crear el combo', 'error')
    }
  }

  return (
    <Modal title="Nuevo combo" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Input id="nombre" label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input id="precio" label="Precio del combo" type="number" step="0.01" min="0" required value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <Input id="descripcion" label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Productos incluidos</span>
            <Button type="button" variant="ghost" onClick={addRow} className="!px-2 !py-1 text-xs">
              <Plus size={13} /> Agregar
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={row.producto}
                  onChange={(e) => updateItem(i, { producto: e.target.value })}
                  className="flex-1"
                >
                  <option value="">Elegí un producto…</option>
                  {productos?.results.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Select>
                <Input
                  type="number" min="1" step="1" value={row.cantidad}
                  onChange={(e) => updateItem(i, { cantidad: e.target.value })}
                  className="w-20"
                />
                <button type="button" onClick={() => removeRow(i)} className="rounded p-2 text-text-dim hover:bg-danger/10 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={createCombo.isPending}>
            {createCombo.isPending && <Loader2 size={14} className="animate-spin" />}
            Crear combo
          </Button>
        </div>
      </form>
    </Modal>
  )
}
