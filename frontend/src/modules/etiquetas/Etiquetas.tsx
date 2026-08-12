import { useState } from 'react'
import { Printer, Search, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { formatMoney } from '../../lib/format'
import { useProductoSearch } from '../productos/api'
import type { Producto } from '../productos/types'
import { BarcodeLabel } from './BarcodeLabel'

interface Seleccion {
  producto: Producto
  cantidad: number
}

export function Etiquetas() {
  const [query, setQuery] = useState('')
  const [seleccion, setSeleccion] = useState<Record<string, Seleccion>>({})
  const { data: resultados } = useProductoSearch(query)

  function agregar(producto: Producto) {
    setSeleccion((prev) => ({
      ...prev,
      [producto.id]: { producto, cantidad: prev[producto.id]?.cantidad ?? 1 },
    }))
    setQuery('')
  }

  function quitar(id: string) {
    setSeleccion((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function setCantidad(id: string, cantidad: number) {
    setSeleccion((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], cantidad: Math.max(1, cantidad) } } : prev))
  }

  const items = Object.values(seleccion)
  const etiquetas = items.flatMap((item) => Array.from({ length: item.cantidad }, () => item.producto))

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex flex-col gap-4">
        <p className="text-sm text-text-dim">Buscá productos, elegí la cantidad de etiquetas por producto e imprimí la hoja.</p>

        <div className="relative max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <Input
            placeholder="Buscar por nombre o código de barras…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {resultados && resultados.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregar(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  <span>{p.nombre}</span>
                  <span className="text-text-dim">{formatMoney(p.precio_venta)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">Producto</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">Precio</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">Cantidad</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map(({ producto, cantidad }) => (
                  <tr key={producto.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-text">{producto.nombre}</td>
                    <td className="px-4 py-2 tabular-nums text-text">{formatMoney(producto.precio_venta)}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={1}
                        value={cantidad}
                        onChange={(e) => setCantidad(producto.id, Number(e.target.value))}
                        className="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => quitar(producto.id)} className="text-text-dim hover:text-danger" aria-label="Quitar">
                        <X size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <Button onClick={() => window.print()} disabled={etiquetas.length === 0}>
            <Printer size={15} /> Imprimir{etiquetas.length > 0 ? ` (${etiquetas.length})` : ''}
          </Button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .etiquetas-print-area, .etiquetas-print-area * { visibility: visible; }
          .etiquetas-print-area { position: absolute; inset: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="etiquetas-print-area grid grid-cols-3 gap-2">
        {etiquetas.length === 0 ? (
          <p className="no-print col-span-3 py-16 text-center text-text-dim">Todavía no elegiste productos para etiquetar.</p>
        ) : (
          etiquetas.map((producto, i) => (
            <div key={`${producto.id}-${i}`} className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border p-2 text-center">
              <span className="w-full truncate text-[11px] font-medium text-text">{producto.nombre}</span>
              <BarcodeLabel value={producto.codigo_barras} />
              <span className="text-xs font-semibold text-text">{formatMoney(producto.precio_venta)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
