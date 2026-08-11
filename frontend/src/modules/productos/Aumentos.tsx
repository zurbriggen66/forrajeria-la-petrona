import { useState, type FormEvent } from 'react'
import { Loader2, TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useAplicarAjuste, useCategorias, useProveedores } from './api'

export function Aumentos() {
  const { toast } = useToast()
  const { data: categorias } = useCategorias()
  const { data: proveedores } = useProveedores()
  const aplicar = useAplicarAjuste()

  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<'porcentaje' | 'monto'>('porcentaje')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [resultado, setResultado] = useState<number | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setResultado(null)
    try {
      const res = await aplicar.mutateAsync({
        descripcion,
        tipo,
        valor,
        categoria: categoria || undefined,
        proveedor: proveedor || undefined,
      })
      setResultado(res.cant_productos)
      toast(`Se actualizaron ${res.cant_productos} producto${res.cant_productos === 1 ? '' : 's'}`)
      setDescripcion('')
      setValor('')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo aplicar el aumento'), 'error')
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-text-dim">
        Esta acción actualiza el <strong className="text-text">precio de venta</strong> de todos los productos
        activos que coincidan con el filtro. No se puede deshacer, pero queda registrada en el historial.
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <Input
          id="descripcion" label="Descripción (opcional)" placeholder="Ej: Ajuste por inflación agosto"
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select id="tipo" label="Tipo de ajuste" value={tipo} onChange={(e) => setTipo(e.target.value as 'porcentaje' | 'monto')}>
            <option value="porcentaje">Porcentaje (%)</option>
            <option value="monto">Monto fijo ($)</option>
          </Select>
          <Input
            id="valor" label={tipo === 'porcentaje' ? 'Porcentaje' : 'Monto'} type="number" step="0.01" required
            placeholder={tipo === 'porcentaje' ? 'Ej: 10' : 'Ej: 500'}
            value={valor} onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select id="categoria" label="Filtrar por categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias?.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </Select>
          <Select id="proveedor" label="Filtrar por proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
        </div>

        <Button type="submit" disabled={aplicar.isPending} className="justify-center">
          {aplicar.isPending ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
          Aplicar aumento
        </Button>

        {resultado !== null && (
          <p className="text-center text-sm text-accent-2">
            Se actualizaron {resultado} producto{resultado === 1 ? '' : 's'}.
          </p>
        )}
      </form>
    </div>
  )
}
