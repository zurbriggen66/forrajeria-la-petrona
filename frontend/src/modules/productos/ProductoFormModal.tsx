import { useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
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
    bolsa_kg: '',
    precio_bolsa: '',
    stock_en_bolsas: false,
    oferta_activa: false,
    precio_oferta: '',
    destacado: false,
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

  const bolsaKg = Number(form.bolsa_kg)
  const precioBolsa = Number(form.precio_bolsa)
  const tieneBolsa = bolsaKg > 0 && precioBolsa > 0
  const precioBolsaPorKg = tieneBolsa ? precioBolsa / bolsaKg : null
  // El stock siempre se guarda en kg (ver Producto.stock en el backend); esto
  // sólo decide en qué unidad lo tipea y lo ve el dueño en este formulario.
  const stockEnBolsas = Boolean(form.venta_por_peso && form.stock_en_bolsas && tieneBolsa)

  function set<K extends keyof ProductoInput>(key: K, value: ProductoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function valorStockMostrado(kgValue: string | null | undefined): string {
    if (!stockEnBolsas) return kgValue ?? '0'
    return String(Math.round(((Number(kgValue) || 0) / bolsaKg) * 100) / 100)
  }

  function cambiarStock(key: 'stock' | 'stock_minimo', valorMostrado: string) {
    if (!stockEnBolsas) {
      set(key, valorMostrado)
      return
    }
    set(key, String((Number(valorMostrado) || 0) * bolsaKg))
  }

  // precio_costo se guarda siempre "por kg" (así el margen se compara contra
  // precio_venta, que también es por kg) — acá sólo se multiplica/divide por
  // bolsaKg para mostrarlo y cargarlo como costo de la bolsa entera.
  function valorCostoMostrado(costoPorKg: string | null | undefined): string {
    if (!stockEnBolsas) return costoPorKg ?? '0'
    return String(Math.round((Number(costoPorKg) || 0) * bolsaKg * 100) / 100)
  }

  function cambiarCosto(valorMostrado: string) {
    if (!stockEnBolsas) {
      set('precio_costo', valorMostrado)
      return
    }
    set('precio_costo', String((Number(valorMostrado) || 0) / bolsaKg))
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

        <section className="rounded-lg border border-border bg-surface-2/50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={form.venta_por_peso ?? false}
              onChange={(e) => {
                const venta_por_peso = e.target.checked
                setForm((prev) => ({
                  ...prev,
                  venta_por_peso,
                  // "unidad" no es una unidad de peso válida — sin esto, si el
                  // usuario tilda "a granel" y no toca el select de Unidad, se
                  // guarda "unidad" igual (aunque el select ya muestre "kg").
                  unidad_medida: venta_por_peso && (!prev.unidad_medida || prev.unidad_medida === 'unidad')
                    ? 'kg' : prev.unidad_medida,
                }))
              }}
              className="accent-accent"
            />
            Este producto se vende por kilo (a granel)
          </label>
          <p className="mt-1 text-xs text-text-dim">
            Ej: alimento balanceado que se pesa suelto y también se vende en bolsas cerradas.
          </p>

          {form.venta_por_peso && (
            <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
              <Select
                id="unidad_medida" label="Se pesa en" value={form.unidad_medida ?? 'kg'}
                onChange={(e) => set('unidad_medida', e.target.value)}
                className="max-w-40"
              >
                {UNIDADES.filter((u) => u !== 'unidad').map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>

              <Input
                id="precio_venta" label={`Precio vendido suelto (por ${form.unidad_medida || 'kg'})`}
                type="number" step="0.01" min="0" required
                value={form.precio_venta ?? '0'} onChange={(e) => set('precio_venta', e.target.value)}
              />

              <div>
                <p className="mb-2 text-xs text-text-dim">
                  Opcional: completá esto si además la vendés en bolsas cerradas (ej. bolsas de 20kg), sin dejar de venderla suelta.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="bolsa_kg" label={`${form.unidad_medida || 'kg'} por bolsa`} type="number" step="0.001" min="0"
                    value={form.bolsa_kg ?? ''} onChange={(e) => set('bolsa_kg', e.target.value)}
                  />
                  <Input
                    id="precio_bolsa" label="Precio por bolsa" type="number" step="0.01" min="0"
                    value={form.precio_bolsa ?? ''} onChange={(e) => set('precio_bolsa', e.target.value)}
                  />
                </div>
                {precioBolsaPorKg !== null && (
                  <>
                    <p className="mt-2 text-xs text-text-dim">
                      La bolsa entera sale <span className="text-accent-2">{formatMoney(precioBolsaPorKg)}/{form.unidad_medida || 'kg'}</span>
                      {Number(form.precio_venta) > 0 && (
                        <> — vendido suelto sale <span className="text-warning">{formatMoney(form.precio_venta!)}/{form.unidad_medida || 'kg'}</span></>
                      )}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-text-dim">Cargar y ver el stock en</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => set('stock_en_bolsas', false)}
                          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                            !form.stock_en_bolsas ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
                          }`}
                        >
                          {form.unidad_medida || 'kg'}
                        </button>
                        <button
                          type="button"
                          onClick={() => set('stock_en_bolsas', true)}
                          className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                            form.stock_en_bolsas ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
                          }`}
                        >
                          Bolsas
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <section className={form.venta_por_peso ? 'grid grid-cols-3 gap-4' : 'grid grid-cols-4 gap-4'}>
          <Input
            id="precio_costo"
            label={stockEnBolsas ? 'Precio costo (por bolsa)' : form.venta_por_peso ? `Precio costo (por ${form.unidad_medida || 'kg'})` : 'Precio costo'}
            type="number" step="0.01" min="0"
            value={valorCostoMostrado(form.precio_costo)} onChange={(e) => cambiarCosto(e.target.value)}
          />
          {!form.venta_por_peso && (
            <Input
              id="precio_venta" label="Precio venta"
              type="number" step="0.01" min="0" required
              value={form.precio_venta ?? '0'} onChange={(e) => set('precio_venta', e.target.value)}
            />
          )}
          <Input
            id="stock"
            label={stockEnBolsas ? 'Stock (bolsas)' : form.venta_por_peso ? `Stock (${form.unidad_medida || 'kg'})` : 'Stock'}
            type="number" step="0.001" min="0"
            value={valorStockMostrado(form.stock)} onChange={(e) => cambiarStock('stock', e.target.value)}
          />
          <Input
            id="stock_minimo"
            label={stockEnBolsas ? 'Stock mínimo (bolsas)' : form.venta_por_peso ? `Stock mínimo (${form.unidad_medida || 'kg'})` : 'Stock mínimo'}
            type="number" step="0.001" min="0"
            value={valorStockMostrado(form.stock_minimo)} onChange={(e) => cambiarStock('stock_minimo', e.target.value)}
          />
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

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={form.destacado ?? false}
            onChange={(e) => set('destacado', e.target.checked)}
            className="accent-accent"
          />
          Destacado — aparece en los accesos rápidos de Venta
        </label>

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
