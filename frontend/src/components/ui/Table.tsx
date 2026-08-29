import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { extraerMensajeError } from '../../lib/errors'
import { Button } from './Button'

export interface Column<T> {
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  onRowClick?: (row: T) => void
  /** El error de la consulta, si falló. Sin esto, un 500 del backend se veía
   * exactamente igual que "no hay resultados" y nadie se enteraba de que la
   * pantalla estaba mostrando datos incompletos. */
  error?: unknown
  /** `refetch` de React Query. Sin esto la única salida era recargar con F5. */
  onRetry?: () => void
}

export function Table<T>({
  columns, rows, rowKey, emptyMessage = 'Sin resultados.', onRowClick, error, onRetry,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.header}
                className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8">
                <div className="flex flex-col items-center gap-3 text-danger">
                  <AlertTriangle size={20} />
                  <span className="text-center text-sm">
                    {extraerMensajeError(error, 'No se pudieron cargar los datos.')}
                  </span>
                  {onRetry && (
                    <Button variant="secondary" onClick={onRetry}>
                      <RefreshCcw size={14} /> Reintentar
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-text-dim">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border last:border-0 transition-colors hover:bg-surface-2 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-3 text-text ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
