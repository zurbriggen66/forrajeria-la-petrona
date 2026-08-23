import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Barra de paginación para listados largos. El catálogo del cliente tiene
 * miles de productos: sin esto sólo se veían los primeros de la primera
 * página y el resto era inalcanzable salvo buscando por nombre. */
export function Paginacion({ pagina, porPagina, total, onCambiar }: {
  pagina: number
  porPagina: number
  total: number
  onCambiar: (pagina: number) => void
}) {
  const paginas = Math.max(Math.ceil(total / porPagina), 1)
  if (total === 0) return null

  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-text-dim">
        Mostrando <span className="tabular-nums text-text">{desde}–{hasta}</span> de{' '}
        <span className="tabular-nums text-text">{total.toLocaleString('es-AR')}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina <= 1}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-text-dim transition-colors hover:border-accent/50 hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-dim"
        >
          <ChevronLeft size={15} /> Anterior
        </button>
        <span className="px-2 tabular-nums text-text-dim">
          Página {pagina} de {paginas.toLocaleString('es-AR')}
        </span>
        <button
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina >= paginas}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-text-dim transition-colors hover:border-accent/50 hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-dim"
        >
          Siguiente <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
