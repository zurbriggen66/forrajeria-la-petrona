import { useState } from 'react'
import { Loader2, UserRound } from 'lucide-react'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Paginacion } from '../../components/ui/Paginacion'
import { formatMoney } from '../../lib/format'
import { useDebounce } from '../../lib/useDebounce'
import { useClientesBrowse } from './api'
import type { Cliente } from './types'

/** Lista completa de clientes, con búsqueda y paginación, para cuando no se
 * acuerda cómo quedó agendado (nombre exacto, apodo, etc.) y prefiere
 * recorrer la lista en vez de adivinar qué escribir. */
export function ClienteSelectorModal({ onSeleccionar, onClose }: {
  onSeleccionar: (cliente: Cliente) => void
  onClose: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const busquedaDiferida = useDebounce(busqueda)
  const { data, isLoading } = useClientesBrowse(busquedaDiferida, pagina)

  return (
    <Modal title="Elegir cliente" onClose={onClose} ancho="lg">
      <div className="flex flex-col gap-3">
        <Input
          id="cliente-selector-busqueda" placeholder="Nombre, teléfono o CUIT…" autoFocus
          value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
        />

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-text-dim">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : (data?.results.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-text-dim">Ningún cliente coincide con esa búsqueda.</p>
        ) : (
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {data!.results.map((c) => (
              <button
                key={c.id}
                onClick={() => onSeleccionar(c)}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <UserRound size={14} className="shrink-0 text-accent" />
                  <span className="truncate">
                    <span className="font-medium text-text">{c.nombre}</span>
                    {c.telefono && <span className="ml-2 text-text-dim">{c.telefono}</span>}
                  </span>
                </span>
                {Number(c.saldo_actual) > 0 && (
                  <span className="shrink-0 tabular-nums text-xs text-danger">debe {formatMoney(c.saldo_actual)}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {data && data.count > 15 && (
          <Paginacion pagina={pagina} porPagina={15} total={data.count} onCambiar={setPagina} />
        )}
      </div>
    </Modal>
  )
}
