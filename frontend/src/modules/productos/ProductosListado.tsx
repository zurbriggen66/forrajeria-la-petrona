import { useState } from 'react'
import { AlertTriangle, Loader2, Pencil, Plus, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Table, type Column } from '../../components/ui/Table'
import { formatMoney, formatPct } from '../../lib/format'
import { useCategorias, useProductos } from './api'
import { ProductoFormModal } from './ProductoFormModal'
import type { Producto } from './types'

export function ProductosListado() {
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const [modal, setModal] = useState<'new' | Producto | null>(null)

  const { data: categorias } = useCategorias()
  const { data, isLoading, isError } = useProductos({
    search: search || undefined,
    categoria: categoria || undefined,
    ordering: 'nombre',
  })

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
          {p.stock}{p.venta_por_peso ? ` ${p.unidad_medida}` : ''}
        </span>
      ),
    },
    {
      header: '',
      className: 'text-right',
      render: (p) => (
        <button onClick={() => setModal(p)} className="rounded p-1.5 text-text-dim hover:bg-surface-2 hover:text-accent" aria-label={`Editar ${p.nombre}`}>
          <Pencil size={15} />
        </button>
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
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"
          />
        </div>
        <Select id="filtro-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-52">
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
          <p className="text-xs text-text-dim">{data.count} producto{data.count === 1 ? '' : 's'}</p>
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
