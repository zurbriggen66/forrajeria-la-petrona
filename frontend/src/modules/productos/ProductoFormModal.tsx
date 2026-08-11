import { useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { buscarProductoUniversal, useCategorias, useCreateProducto, useProveedores, useUpdateProducto } from './api'
import type { Producto, ProductoInput } from './types'

const UNIDADES = ['unidad', 'kg', 'g', 'lt']

function emptyForm(): ProductoInput {
  return {
    codigo_barras: '',
    nombre: '',
    categoria: '',
    subcategoria: '',
    proveedor: null,
    precio_costo: '0',
    precio_venta: '0',
    stock: '0',
    stock_minimo: '0',
    venta_por_peso: false,
    unidad_medida: 'unidad',
    plu_balanza: '',
    oferta_activa: false,
    precio_oferta: '',
    modelo_nombre: '',
    talle: '',
    color: '',
    activo: true,
  }
}

export function ProductoFormModal({ producto, onClose }: { producto?: Producto; onClose: () => void }) {
  const { toast } = useToast()
  const { data: categorias } = useCategorias()
  const { data: proveedores } = useProveedores()
  const createProducto = useCreateProducto()
  const updateProducto = useUpdateProducto()

  const [form, setForm] = useState<ProductoInput>(() => (producto ? { ...producto } : emptyForm()))
  const [autocompletando, setAutocompletando] = useState(false)
  const [autocompletado, setAutocompletado] = useState(false)

  const isEdit = Boolean(producto)
  const saving = createProducto.isPending || updateProducto.isPending

  function set<K extends keyof ProductoInput>(key: K, value: ProductoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCodigoBarrasBlur() {
    if (isEdit || !form.codigo_barras || form.nombre) return
    setAutocompletando(true)
    try {
      const match = await buscarProductoUniversal(form.codigo_barras)
      if (match) {
        setForm((prev) => ({
          ...prev,
          nombre: prev.nombre || match.nombre,
          categoria: prev.categoria || match.categoria,
          descripcion: prev.descripcion || match.descripcion,
        }))
        setAutocompletado(true)
        toast(`Autocompletado desde catálogo: ${match.nombre}`, 'info')
      }
    } finally {
      setAutocompletando(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      if (isEdit && producto) {
        await updateProducto.mutateAsync({ id: producto.id, input: form })
        toast('Producto actualizado')
      } else {
        await createProducto.mutateAsync(form)
        toast('Producto creado')
      }
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el producto'), 'error')
    }
  }

  return (
    <Modal title={isEdit ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <section className="grid grid-cols-2 gap-4">
          <div className="relative">
            <Input
              id="codigo_barras"
              label="Código de barras"
              value={form.codigo_barras ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, codigo_barras: e.target.value }))}
              onBlur={handleCodigoBarrasBlur}
              placeholder="Escaneá o tipeá el código"
            />
            {autocompletando && (
              <Loader2 size={14} className="absolute right-3 top-9 animate-spin text-text-dim" />
            )}
            {autocompletado && !autocompletando && (
              <span className="mt-1 flex items-center gap-1 text-xs text-accent-2">
                <Sparkles size={12} /> Autocompletado desde el catálogo universal
              </span>
            )}
          </div>
          <Input
            id="nombre"
            label="Nombre"
            required
            value={form.nombre ?? ''}
            onChange={(e) => set('nombre', e.target.value)}
          />

          <Select
            id="categoria"
            label="Categoría"
            value={form.categoria ?? ''}
            onChange={(e) => set('categoria', e.target.value)}
          >
            <option value="">Sin categoría</option>
            {categorias?.map((c) => (
              <option key={c.id} value={c.nombre}>{c.nombre}</option>
            ))}
          </Select>
          <Select
            id="proveedor"
            label="Proveedor"
            value={form.proveedor ?? ''}
            onChange={(e) => set('proveedor', e.target.value || null)}
          >
            <option value="">Sin proveedor</option>
            {proveedores?.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </section>

        <section className="grid grid-cols-4 gap-4">
          <Input
            id="precio_costo" label="Precio costo" type="number" step="0.01" min="0"
            value={form.precio_costo ?? '0'} onChange={(e) => set('precio_costo', e.target.value)}
          />
          <Input
            id="precio_venta" label="Precio venta" type="number" step="0.01" min="0" required
            value={form.precio_venta ?? '0'} onChange={(e) => set('precio_venta', e.target.value)}
          />
          <Input
            id="stock" label="Stock" type="number" step="0.001" min="0"
            value={form.stock ?? '0'} onChange={(e) => set('stock', e.target.value)}
          />
          <Input
            id="stock_minimo" label="Stock mínimo" type="number" step="0.001" min="0"
            value={form.stock_minimo ?? '0'} onChange={(e) => set('stock_minimo', e.target.value)}
          />
        </section>

        <section className="rounded-lg border border-border bg-surface-2/50 p-4">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={form.venta_por_peso ?? false}
              onChange={(e) => set('venta_por_peso', e.target.checked)}
              className="accent-accent"
            />
            Se vende por peso / balanza
          </label>
          {form.venta_por_peso && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Select
                id="unidad_medida" label="Unidad" value={form.unidad_medida ?? 'kg'}
                onChange={(e) => set('unidad_medida', e.target.value)}
              >
                {UNIDADES.filter((u) => u !== 'unidad').map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
              <Input
                id="plu_balanza" label="PLU balanza" value={form.plu_balanza ?? ''}
                onChange={(e) => set('plu_balanza', e.target.value)}
              />
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface-2/50 p-4">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={form.oferta_activa ?? false}
              onChange={(e) => set('oferta_activa', e.target.checked)}
              className="accent-accent"
            />
            Oferta activa
          </label>
          {form.oferta_activa && (
            <div className="mt-3">
              <Input
                id="precio_oferta" label="Precio oferta" type="number" step="0.01" min="0"
                value={form.precio_oferta ?? ''} onChange={(e) => set('precio_oferta', e.target.value)}
              />
            </div>
          )}
        </section>

        {form.categoria === 'Indumentaria' && (
          <section className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-surface-2/50 p-4">
            <Input
              id="modelo_nombre" label="Modelo" value={form.modelo_nombre ?? ''}
              onChange={(e) => set('modelo_nombre', e.target.value)}
            />
            <Input
              id="talle" label="Talle" value={form.talle ?? ''}
              onChange={(e) => set('talle', e.target.value)}
            />
            <Input
              id="color" label="Color" value={form.color ?? ''}
              onChange={(e) => set('color', e.target.value)}
            />
          </section>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
