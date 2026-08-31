import { useMemo, useState } from 'react'
import { Layers } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { useCategorias } from '../productos/api'
import { etiquetaEnvase } from '../productos/presentacion'
import { formatCantidadStock } from '../productos/stock'
import { tieneBolsa } from './precio'
import type { Combo, Producto } from '../productos/types'
import type { CartItemPack } from './types'

/** Mismo criterio que en el carrito: mostrar el stock ANTES de tocar el
 * producto, no que el cajero se entere recién al cargar la cantidad. */
function StockChip({ p }: { p: Producto }) {
  const stock = Number(p.stock)
  return (
    <span className={`text-[10px] leading-none ${stock <= 0 ? 'text-warning' : 'text-text-dim'}`}>
      Stock: {formatCantidadStock(p.stock, p)}
    </span>
  )
}

interface Props {
  productos: Producto[]
  onAgregar: (producto: Producto, esBolsa: boolean) => void
  packs: Combo[]
  onAgregarPack: (pack: CartItemPack['pack']) => void
}

const PACKS = 'Packs'
const DESTACADOS = 'Destacados'
const TODAS = 'Todas'
// Grilla de UN CLIC, no el buscador exhaustivo (para eso está ProductSearch,
// que sí trae todo el catálogo por texto): un catálogo grande tarda en
// pintar cientos de tarjetas, así que se corta acá y listo.
const MAX_VISIBLES = 20

/** Grilla de un clic para no tener que tipear en el buscador — con tabs por
 * categoría (además de "Destacados" y "Todas") para que se pueda navegar el
 * catálogo de la forrajería sin escribir nada. Los productos a granel con
 * bolsa cerrada muestran un botón aparte para sumar la bolsa directo desde
 * acá, sin pasar por el buscador. */
/** "10x Balanceado + 12x Huevo": que lleva el pack, para el boton y para la
 * fila del carrito. */
function detallePack(pack: Combo) {
  return pack.items.map((i) => `${Number(i.cantidad)}x ${i.producto_nombre}`).join(' + ')
}

export function QuickProducts({ productos, onAgregar, packs, onAgregarPack }: Props) {
  const { data: categorias } = useCategorias()
  const [tabElegida, setTabElegida] = useState<string | null>(null)

  const hayDestacados = useMemo(() => productos.some((p) => p.destacado), [productos])

  const tabs = useMemo(() => {
    const presentes = new Set(productos.map((p) => p.categoria).filter(Boolean))
    const nombres = (categorias ?? [])
      .filter((c) => c.activa && presentes.has(c.nombre))
      .sort((a, b) => a.orden - b.orden)
      .map((c) => c.nombre)
    // Packs primero: es una pestaña chica y fija, y si quedara al final entre
    // las categorías del catálogo nadie la encontraría.
    return [
      ...(packs.length > 0 ? [PACKS] : []),
      ...(hayDestacados ? [DESTACADOS] : []),
      TODAS,
      ...nombres,
    ]
  }, [productos, categorias, hayDestacados, packs.length])

  const tabActiva = tabElegida && tabs.includes(tabElegida) ? tabElegida : tabs[0]

  const enTab = useMemo(() => {
    if (!tabActiva) return []
    if (tabActiva === DESTACADOS) return productos.filter((p) => p.destacado)
    if (tabActiva === TODAS) return productos
    return productos.filter((p) => p.categoria === tabActiva)
  }, [productos, tabActiva])

  const visibles = enTab.slice(0, MAX_VISIBLES)

  // "Todas" siempre está en tabs; lo que de verdad indica catálogo vacío (o
  // todavía cargando) es no tener productos, no la cantidad de tabs.
  if (productos.length === 0 && packs.length === 0) return null

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

      {/* Tarjetas chicas y grilla baja a propósito: esta grilla es un atajo,
          el que tiene que respirar es el carrito. Cuando la grilla se comía
          19rem, una venta de seis renglones dejaba el carrito en un canuto de
          dos filas con scroll. Los botones NO se achican: se tocan con el dedo
          en una tablet de mostrador. */}
      <div className="grid max-h-[13rem] grid-cols-3 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
        {tabActiva === PACKS && packs.map((pack) => {
          const sinStock = pack.armables <= 0
          return (
            <button
              key={pack.id}
              onClick={() => onAgregarPack({
                id: pack.id,
                nombre: pack.nombre,
                precio: pack.precio,
                armables: pack.armables,
                detalle: detallePack(pack),
              })}
              className="flex flex-col items-start rounded-lg border border-accent/30 bg-accent/5 p-2 text-left transition-colors hover:border-accent hover:bg-accent/10"
            >
              <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-accent">
                <Layers size={10} /> pack
              </span>
              <span className="line-clamp-2 min-h-7 text-xs font-medium leading-tight text-text">{pack.nombre}</span>
              <span className="tabular-nums text-[13px] font-semibold text-accent">{formatMoney(pack.precio)}</span>
              {/* Cuántos entran en el stock de hoy: el pack se puede tocar igual
                  (el servidor decide), pero el cajero tiene que verlo antes. */}
              <span className={`text-[10px] leading-none ${sinStock ? 'text-danger' : 'text-text-dim'}`}>
                {sinStock ? 'sin stock para armarlo' : `alcanza para ${pack.armables}`}
              </span>
            </button>
          )
        })}
        {tabActiva !== PACKS && visibles.map((p) => {
          const conBolsa = tieneBolsa(p)
          const precioSuelto = formatMoney(p.oferta_activa && p.precio_oferta ? p.precio_oferta : p.precio_venta)
          return (
            <div
              key={p.id}
              className="flex flex-col rounded-lg border border-border bg-surface p-2 transition-colors hover:border-accent/50"
            >
              {/* Con bolsa: dos botones etiquetados, para que el cajero vea dónde
                  apretar según cómo le compran. Sin bolsa: la tarjeta entera agrega. */}
              {conBolsa ? (
                <>
                  <span className="line-clamp-2 min-h-7 text-xs font-medium leading-tight text-text">{p.nombre}</span>
                  <StockChip p={p} />
                  <div className="mt-1.5 flex flex-col gap-1">
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
                <button onClick={() => onAgregar(p, false)} className="flex flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="line-clamp-2 text-xs font-medium leading-tight text-text">{p.nombre}</span>
                  <span className="tabular-nums text-[13px] font-semibold text-accent-2">
                    {precioSuelto}
                    {p.venta_por_peso && <span className="text-xs font-normal text-text-dim"> /{p.unidad_medida}</span>}
                  </span>
                  <StockChip p={p} />
                </button>
              )}
            </div>
          )
        })}
        {visibles.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-text-dim">Sin productos en esta categoría.</p>
        )}
      </div>
      {enTab.length > MAX_VISIBLES && (
        <p className="text-center text-xs text-text-dim">
          Mostrando {MAX_VISIBLES} de {enTab.length} — buscá por nombre o código para ver el resto.
        </p>
      )}
    </div>
  )
}
