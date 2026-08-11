import { useState } from 'react'
import { Loader2, PackagePlus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useCrearPedidoManual, usePedidosSugeridos } from './api'
import type { PedidoSugerido } from './types'

export function PedidosSugeridos() {
  const { data, isLoading } = usePedidosSugeridos()
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const crearPedido = useCrearPedidoManual()
  const { toast } = useToast()

  function toggle(producto: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(producto)) next.delete(producto)
      else next.add(producto)
      return next
    })
  }

  async function handleCrearPedido() {
    const items = (data ?? [])
      .filter((i) => seleccionados.has(i.producto))
      .map((i) => ({
        producto: i.producto, nombre: i.nombre, cantidad: i.cantidad_sugerida,
        proveedor: i.proveedor, proveedor_nombre: i.proveedor_nombre,
      }))
    if (items.length === 0) {
      toast('Elegí al menos un producto', 'error')
      return
    }
    try {
      await crearPedido.mutateAsync(items)
      toast('Pedido creado en borrador')
      setSeleccionados(new Set())
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo crear el pedido'), 'error')
    }
  }

  const columns: Column<PedidoSugerido>[] = [
    {
      header: '',
      render: (i) => (
        <input
          type="checkbox" checked={seleccionados.has(i.producto)}
          onChange={() => toggle(i.producto)} onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    { header: 'Producto', render: (i) => i.nombre },
    { header: 'Proveedor', render: (i) => i.proveedor_nombre ?? 'Sin proveedor' },
    { header: 'Stock', render: (i) => i.stock, className: 'tabular-nums' },
    { header: 'Mínimo', render: (i) => i.stock_minimo, className: 'tabular-nums' },
    { header: 'Sugerido', render: (i) => i.cantidad_sugerida, className: 'tabular-nums font-medium text-accent' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">Productos por debajo de su stock mínimo. Elegí los que querés pedir.</p>
        <Button onClick={handleCrearPedido} disabled={crearPedido.isPending || seleccionados.size === 0}>
          <PackagePlus size={15} /> Crear pedido ({seleccionados.size})
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Calculando…
        </div>
      ) : (
        <Table
          columns={columns}
          rows={data ?? []}
          rowKey={(i) => i.producto}
          emptyMessage="No hay productos por debajo del stock mínimo ahora mismo."
          onRowClick={(i) => toggle(i.producto)}
        />
      )}
    </div>
  )
}
