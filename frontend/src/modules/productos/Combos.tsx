import { useState } from 'react'
import { AlertTriangle, Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { useCombos, useDeleteCombo } from './api'
import { ComboFormModal } from './ComboFormModal'
import type { Combo } from './types'

export function Combos() {
  const { toast } = useToast()
  const [editando, setEditando] = useState<Combo | null>(null)
  const [creando, setCreando] = useState(false)
  const [aBorrar, setABorrar] = useState<Combo | null>(null)
  const { data: combos, isLoading, isError } = useCombos()
  const borrar = useDeleteCombo()

  async function handleBorrar(combo: Combo) {
    try {
      await borrar.mutateAsync(combo.id)
      toast('Pack eliminado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo eliminar el pack'), 'error')
    } finally {
      setABorrar(null)
    }
  }

  const columns: Column<Combo>[] = [
    {
      header: 'Pack',
      render: (c) => (
        <div>
          <p className="font-medium text-text">{c.nombre}</p>
          <p className="text-xs text-text-dim">
            {c.items.map((i) => `${Number(i.cantidad)}× ${i.producto_nombre}`).join(' + ') || '—'}
          </p>
        </div>
      ),
    },
    {
      header: 'Suelto',
      className: 'tabular-nums text-text-dim',
      render: (c) => formatMoney(c.precio_suelto),
    },
    {
      header: 'Precio del pack',
      className: 'tabular-nums',
      render: (c) => <span className="font-medium text-text">{formatMoney(c.precio)}</span>,
    },
    {
      header: 'Le regalás',
      render: (c) => {
        if (c.descuento_pct === null) return <span className="text-text-dim">—</span>
        // Negativo = el pack sale MÁS caro que suelto. Casi siempre es un error
        // de carga y no se puede dejar pasar callado.
        const caro = c.descuento_pct < 0
        return (
          <span className={`tabular-nums ${caro ? 'text-danger' : 'text-accent-2'}`}>
            {caro && <AlertTriangle size={12} className="mr-1 inline" />}
            {c.descuento_pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      header: 'Margen',
      render: (c) => (
        c.margen_pct === null
          ? <span className="text-text-dim">—</span>
          : <span className={`tabular-nums ${c.margen_pct < 0 ? 'text-danger' : 'text-text'}`}>{c.margen_pct.toFixed(1)}%</span>
      ),
    },
    {
      header: 'Armables hoy',
      render: (c) => (
        <span className={`flex items-center gap-1.5 tabular-nums ${c.armables === 0 ? 'text-warning' : 'text-text'}`}>
          <Layers size={13} className="shrink-0" />
          {c.armables}
        </span>
      ),
    },
    {
      header: '',
      className: 'text-right',
      render: (c) => (
        <span className="flex justify-end gap-1">
          <button
            onClick={() => setEditando(c)}
            className="rounded-md p-1.5 text-text-dim hover:bg-surface-2 hover:text-text"
            aria-label={`Editar ${c.nombre}`}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setABorrar(c)}
            className="rounded-md p-1.5 text-text-dim hover:bg-danger/10 hover:text-danger"
            aria-label={`Eliminar ${c.nombre}`}
          >
            <Trash2 size={15} />
          </button>
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-dim">
          Un pack junta varios productos —o varias unidades del mismo— con un precio especial.
          <span className="text-text"> Armables hoy</span> sale del stock del componente más escaso.
        </p>
        <Button onClick={() => setCreando(true)}>
          <Plus size={15} /> Armar pack
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-sm text-text-dim">
        Los packs activos aparecen en el POS, en la pestaña <strong className="text-text">Packs</strong> de la
        grilla. Se cobran a su precio como una línea y descuentan el stock de cada producto que los compone.
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando packs…
        </div>
      )}
      {isError && (
        <div className="flex flex-col items-center gap-2 py-16 text-danger">
          <AlertTriangle size={20} /> No se pudieron cargar los packs.
        </div>
      )}
      {combos && (
        <Table columns={columns} rows={combos} rowKey={(c) => c.id} emptyMessage="Todavía no armaste ningún pack." />
      )}

      {creando && <ComboFormModal onClose={() => setCreando(false)} />}
      {editando && <ComboFormModal combo={editando} onClose={() => setEditando(null)} />}

      {aBorrar && (
        <ConfirmDialog
          titulo="Eliminar pack"
          descripcion={`Se elimina "${aBorrar.nombre}". Los productos que lo componen no se tocan — sólo se borra la receta del pack.`}
          confirmarTexto="Eliminar" peligro
          cargando={borrar.isPending}
          onConfirmar={() => handleBorrar(aBorrar)}
          onCancelar={() => setABorrar(null)}
        />
      )}
    </div>
  )
}
