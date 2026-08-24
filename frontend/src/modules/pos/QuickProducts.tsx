import { useMemo, useState } from 'react'
import { formatMoney } from '../../lib/format'
import { useCategorias } from '../productos/api'
import { etiquetaEnvase } from '../productos/presentacion'
import { tieneBolsa } from './precio'
import type { Producto } from '../productos/types'

interface Props {
  productos: Producto[]
  onAgregar: (producto: Producto, esBolsa: boolean) => void
}

const DESTACADOS = 'Destacados'

/** Grilla de un clic para no tener que tipear en el buscador — con tabs por
 * categoría (además de "Destacados") para que se pueda navegar todo el
 * catálogo de la forrajería, no sólo el puñado marcado a mano. Los productos
 * a granel con bolsa cerrada muestran un botón aparte para sumar la bolsa
 * directo desde acá, sin pasar por el buscador. */
export function QuickProducts({ productos, onAgregar }: Props) {
  const { data: categorias } = useCategorias()
  const [tabElegida, setTabElegida] = useState<string | null>(null)

  const hayDestacados = useMemo(() => productos.some((p) => p.destacado), [productos])

  const tabs = useMemo(() => {
    const presentes = new Set(productos.map((p) => p.categoria).filter(Boolean))
    const nombres = (categorias ?? [])
      .filter((c) => c.activa && presentes.has(c.nombre))
      .sort((a, b) => a.orden - b.orden)
      .map((c) => c.nombre)
    return hayDestacados ? [DESTACADOS, ...nombres] : nombres
  }, [productos, categorias, hayDestacados])

  const tabActiva = tabElegida && tabs.includes(tabElegida) ? tabElegida : tabs[0]

  const visibles = useMemo(() => {
    if (!tabActiva) return []
    if (tabActiva === DESTACADOS) return productos.filter((p) => p.destacado)
    return productos.filter((p) => p.categoria === tabActiva)
  }, [productos, tabActiva])

  if (tabs.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTabElegida(t)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              t === tabActiva ? 'bg-accent/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* max-h en múltiplo de la altura de tarjeta con dos botones, para que la
          segunda fila no quede cortada al medio de un botón. */}
      <div className="grid max-h-[19rem] grid-cols-2 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {visibles.map((p) => {
          const conBolsa = tieneBolsa(p)
          const precioSuelto = formatMoney(p.oferta_activa && p.precio_oferta ? p.precio_oferta : p.precio_venta)
          return (
            <div
              key={p.id}
              className="flex flex-col rounded-xl border border-border bg-surface p-2.5 transition-colors hover:border-accent/50"
            >
              {/* Con bolsa: dos botones etiquetados, para que el cajero vea dónde
                  apretar según cómo le compran. Sin bolsa: la tarjeta entera agrega. */}
              {conBolsa ? (
                <>
                  <span className="line-clamp-2 min-h-8 text-sm font-medium leading-tight text-text">{p.nombre}</span>
                  <div className="mt-2 flex flex-col gap-1">
                    <button
                      onClick={() => onAgregar(p, false)}
                      className="flex items-baseline justify-between gap-2 rounded-lg border border-border px-2 py-1.5 transition-colors hover:border-accent-2/50 hover:bg-accent-2/10"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-text-dim">Suelto</span>
                      <span className="whitespace-nowrap tabular-nums text-xs font-semibold text-accent-2">
                        {precioSuelto}<span className="font-normal text-text-dim">/{p.unidad_medida}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => onAgregar(p, true)}
                      className="flex items-baseline justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1.5 transition-colors hover:bg-accent/20"
                    >
                      <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-accent/80">
                        {etiquetaEnvase(p.unidad_medida, p.bolsa_kg)}
                      </span>
                      <span className="whitespace-nowrap tabular-nums text-xs font-semibold text-accent">
                        {formatMoney(p.precio_bolsa!)}
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={() => onAgregar(p, false)} className="flex flex-1 flex-col items-start gap-1 text-left">
                  <span className="line-clamp-2 text-sm font-medium leading-tight text-text">{p.nombre}</span>
                  <span className="tabular-nums text-sm font-semibold text-accent-2">
                    {precioSuelto}
                    {p.venta_por_peso && <span className="text-xs font-normal text-text-dim"> /{p.unidad_medida}</span>}
                  </span>
                </button>
              )}
            </div>
          )
        })}
        {visibles.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-text-dim">Sin productos en esta categoría.</p>
        )}
      </div>
    </div>
  )
}
