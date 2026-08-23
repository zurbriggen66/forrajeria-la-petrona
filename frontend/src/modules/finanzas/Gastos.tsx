import { useMemo, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Paginacion } from '../../components/ui/Paginacion'
import { StatCard, StatRow, type StatVariant } from '../../components/ui/StatCard'
import { Table, type Column } from '../../components/ui/Table'
import { formatFechaSola, formatMoney } from '../../lib/format'
import { useDebounce } from '../../lib/useDebounce'
import { GASTOS_POR_PAGINA, useGastos, useGastosResumen } from './api'
import { GastoFormModal } from './GastoFormModal'
import type { Gasto, TipoGasto } from './types'

const COPY: Record<TipoGasto, { descripcion: string; boton: string; vacio: string }> = {
  fijo: {
    descripcion: 'Se repiten mes a mes con un monto similar: alquiler, sueldos, servicios. Con la caja abierta, se descuentan del arqueo del turno.',
    boton: 'Nuevo gasto fijo',
    vacio: 'Todavía no registraste gastos fijos.',
  },
  variable: {
    descripcion: 'Cambian de un mes a otro: insumos, pagos puntuales a proveedores, imprevistos. Con la caja abierta, se descuentan del arqueo del turno.',
    boton: 'Nuevo gasto variable',
    vacio: 'Todavía no registraste gastos variables.',
  },
}

// Categorías destacadas con su propio color; el resto (Proveedores, Alquiler,
// Impuestos y cualquier otra) se agrupa en "Otros" para no llenar la fila de
// tarjetas de una categoría que casi no se usa.
const DESTACADAS: { categoria: string; label: string; variant: StatVariant }[] = [
  { categoria: 'Insumos', label: 'Insumos / Stock', variant: 'gold' },
  { categoria: 'Servicios', label: 'Servicios', variant: 'accent' },
  { categoria: 'Sueldos', label: 'Sueldos', variant: 'teal' },
]

export function Gastos({ tipo }: { tipo: TipoGasto }) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const copy = COPY[tipo]

  const searchDiferido = useDebounce(search)
  const filtros = {
    tipo,
    search: searchDiferido || undefined,
    fecha_desde: desde || undefined,
    fecha_hasta: hasta || undefined,
  }
  const { data, isLoading } = useGastos({ ...filtros, page: pagina })
  // Los totales salen del servidor sobre TODO el período filtrado: sumar las
  // filas de la página daría una cifra distinta al pasar de página.
  const { data: resumen } = useGastosResumen(filtros)

  function filtrar(cambio: () => void) {
    cambio()
    setPagina(1)
  }

  const stats = useMemo(() => {
    const porCat = new Map((resumen?.por_categoria ?? []).map((c) => [c.categoria, Number(c.monto)]))
    const destacadas = DESTACADAS.map((d) => ({ ...d, monto: porCat.get(d.categoria) ?? 0 }))
    const nombresDestacados = new Set(DESTACADAS.map((d) => d.categoria))
    const otros = [...porCat.entries()]
      .filter(([cat]) => !nombresDestacados.has(cat))
      .reduce((acc, [, monto]) => acc + monto, 0)
    return { total: Number(resumen?.total ?? 0), porCategoria: destacadas, otros }
  }, [resumen])

  const columns: Column<Gasto>[] = [
    { header: 'Fecha', render: (g) => formatFechaSola(g.fecha) },
    { header: 'Categoría', render: (g) => g.categoria || '—' },
    { header: 'Descripción', render: (g) => g.descripcion || '—' },
    { header: 'Contenedor', render: (g) => g.cuenta_nombre ?? '—' },
    { header: 'Monto', render: (g) => formatMoney(g.monto), className: 'tabular-nums text-danger' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <StatRow>
        <StatCard label="Total gastado" value={formatMoney(stats.total)} variant="total" />
        {stats.porCategoria.map((c) => (
          <StatCard key={c.categoria} label={c.label} value={formatMoney(c.monto)} variant={c.variant} />
        ))}
        <StatCard label="Otros" value={formatMoney(stats.otros)} variant="danger" />
      </StatRow>

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">{copy.descripcion}</p>
        <Button onClick={() => setShowForm(true)} className="shrink-0"><Plus size={15} /> {copy.boton}</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <Input
            id={`buscar-gasto-${tipo}`} placeholder="Buscar por descripción o categoría…"
            value={search} onChange={(e) => filtrar(() => setSearch(e.target.value))} className="pl-9"
          />
        </div>
        <Input
          id={`gasto-desde-${tipo}`} label="Desde" type="date"
          value={desde} onChange={(e) => filtrar(() => setDesde(e.target.value))}
        />
        <Input
          id={`gasto-hasta-${tipo}`} label="Hasta" type="date"
          value={hasta} onChange={(e) => filtrar(() => setHasta(e.target.value))}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando gastos…
        </div>
      ) : (
        <>
          <Table
            columns={columns} rows={data?.results ?? []} rowKey={(g) => g.id}
            emptyMessage={search || desde || hasta ? 'No hay gastos con ese filtro.' : copy.vacio}
          />
          <Paginacion
            pagina={pagina} porPagina={GASTOS_POR_PAGINA}
            total={data?.count ?? 0} onCambiar={setPagina}
          />
        </>
      )}

      {showForm && <GastoFormModal tipoInicial={tipo} onClose={() => setShowForm(false)} />}
    </div>
  )
}

export function GastosFijos() {
  return <Gastos tipo="fijo" />
}

export function GastosVariables() {
  return <Gastos tipo="variable" />
}
