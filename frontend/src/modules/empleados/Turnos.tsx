import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useVendedores } from '../ventas/api'
import { useTurnos } from './api'
import { TurnoFormModal } from './TurnoFormModal'
import type { Turno } from './types'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inicioDeSemana(d: Date): Date {
  const dia = d.getDay() || 7 // domingo -> 7
  const inicio = new Date(d)
  inicio.setDate(d.getDate() - dia + 1) // lunes
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

export function Turnos() {
  const [semana, setSemana] = useState(() => inicioDeSemana(new Date()))
  const [modal, setModal] = useState<{ turno?: Turno; fecha?: string; empleado?: string } | null>(null)

  const { data: empleados } = useVendedores()
  const { data: turnos, isLoading } = useTurnos()

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(semana)
      d.setDate(semana.getDate() + i)
      return d
    }),
    [semana],
  )

  const turnosPorEmpleadoYDia = useMemo(() => {
    const mapa = new Map<string, Turno[]>()
    for (const t of turnos ?? []) {
      if (!t.empleado) continue
      const key = `${t.empleado}_${t.fecha}`
      mapa.set(key, [...(mapa.get(key) ?? []), t])
    }
    return mapa
  }, [turnos])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">Turnos programados por semana. Hacé click en un turno para editarlo, o en el "+" para agregar uno.</p>
        <Button onClick={() => setModal({})}><Plus size={15} /> Nuevo turno</Button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setSemana((s) => { const n = new Date(s); n.setDate(s.getDate() - 7); return n })} className="rounded-lg border border-border p-1.5 text-text-dim hover:text-text">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-text">
          {dias[0].toLocaleDateString('es-AR')} — {dias[6].toLocaleDateString('es-AR')}
        </span>
        <button onClick={() => setSemana((s) => { const n = new Date(s); n.setDate(s.getDate() + 7); return n })} className="rounded-lg border border-border p-1.5 text-text-dim hover:text-text">
          <ChevronRight size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando turnos…
        </div>
      ) : !empleados?.length ? (
        <p className="py-16 text-center text-text-dim">Todavía no hay empleados cargados (ver Config → Usuarios).</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">Empleado</th>
                {dias.map((d, i) => (
                  <th key={d.toISOString()} className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">
                    {DIAS[i]} {d.getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp) => (
                <tr key={emp.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-text">{emp.nombre_completo}</td>
                  {dias.map((d) => {
                    const fecha = toISODate(d)
                    const items = turnosPorEmpleadoYDia.get(`${emp.id}_${fecha}`) ?? []
                    return (
                      <td key={fecha} className="px-2 py-2 align-top">
                        <div className="flex min-h-10 flex-col gap-1">
                          {items.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setModal({ turno: t })}
                              className="rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-left text-xs text-accent hover:bg-accent/20"
                            >
                              {t.hora_inicio?.slice(0, 5) ?? '—'}–{t.hora_fin?.slice(0, 5) ?? '—'}
                            </button>
                          ))}
                          <button
                            onClick={() => setModal({ fecha, empleado: emp.id })}
                            className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-text-dim hover:border-accent/40 hover:text-accent"
                          >
                            + agregar
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <TurnoFormModal
          turno={modal.turno}
          fechaInicial={modal.fecha}
          empleadoInicial={modal.empleado}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
