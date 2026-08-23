import { useState } from 'react'
import { AlertTriangle, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Paginacion } from '../../components/ui/Paginacion'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney, formatPct } from '../../lib/format'
import { useDebounce } from '../../lib/useDebounce'
import { PRODUCTOS_POR_PAGINA, useCategorias, useDeleteProducto, useProductos } from './api'
import { ProductoFormModal } from './ProductoFormModal'
import { formatCantidadStock } from './stock'
import type { Producto } from './types'

export function ProductosListado() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const [pagina, setPagina] = useState(1)
  const [modal, setModal] = useState<'new' | Producto | null>(null)

  const searchDiferido = useDebounce(search)
  const { data: categorias } = useCategorias()
  const { data, isLoading, isError } = useProductos({
    search: searchDiferido || undefined,
    categoria: categoria || undefined,
    activo: true,
    ordering: 'nombre',
    page: pagina,
  })
  const eliminar = useDeleteProducto()

  /** Cambiar un filtro tiene que volver a la página 1: si estabas en la 40 y
   * filtrás algo con 3 resultados, la 40 no existe y la tabla sale vacía. */
  function filtrar(cambio: () => void) {
    cambio()
    setPagina(1)
  }

  async function handleEliminar(p: Producto) {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? Si ya tiene ventas registradas, se va a desactivar en vez de borrarse.`)) return
    try {
      await eliminar.mutateAsync(p.id)
      toast('Producto eliminado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo eliminar el producto'), 'error')
    }
  }

  const columns: Column<Producto>[] = [
    {
      header: 'Producto',
      render: (p) => (
        <div>
          <div className="font-medium">{p.nombre}</div>
          <div className="text-xs text-text-dim">{p.codigo_barras || 'sin código'}</div>
        </div>
      ),
    },
    { header: 'Categoría', render: (p) => p.categoria || '—' },
    { header: 'Costo', render: (p) => formatMoney(p.precio_costo), className: 'tabular-nums' },
    { header: 'Venta', render: (p) => formatMoney(p.precio_venta), className: 'tabular-nums' },
    { header: 'Margen', render: (p) => formatPct(p.margen_pct), className: 'tabular-nums' },
    {
      header: 'Stock',
      render: (p) => (
        <span className={`inline-flex items-center gap-1 tabular-nums ${p.stock_bajo ? 'text-warning' : 'text-text'}`}>
          {p.stock_bajo && <AlertTriangle size={13} />}
          {formatCantidadStock(p.stock, p)}
        </span>
      ),
    },
    {
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setModal(p)} className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Editar ${p.nombre}`}>
            <Pencil size={15} />
          </button>
          <button onClick={() => handleEliminar(p)} className="rounded p-1.5 text-text-dim hover:bg-danger/10 hover:text-danger" aria-label={`Eliminar ${p.nombre}`}>
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <Input
            id="search" placeholder="Buscar por nombre o código de barras…"
            value={search} onChange={(e) => filtrar(() => setSearch(e.target.value))} className="pl-9"
          />
        </div>
        <Select id="filtro-categoria" value={categoria} onChange={(e) => filtrar(() => setCategoria(e.target.value))} className="w-52">
          <option value="">Todas las categorías</option>
          {categorias?.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </Select>
        <Button onClick={() => setModal('new')}>
          <Plus size={15} /> Nuevo producto
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando productos…
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-2 py-16 text-danger">
          <AlertTriangle size={20} />
          <span>No se pudieron cargar los productos. Probá de nuevo.</span>
        </div>
      )}

      {data && (
        <>
          <Table
            columns={columns}
            rows={data.results}
            rowKey={(p) => p.id}
            emptyMessage={search || categoria ? 'No hay productos que coincidan con el filtro.' : 'Todavía no cargaste productos.'}
          />
          <Paginacion
            pagina={pagina} porPagina={PRODUCTOS_POR_PAGINA} total={data.count} onCambiar={setPagina}
          />
        </>
      )}

      {modal && (
        <ProductoFormModal
          producto={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
