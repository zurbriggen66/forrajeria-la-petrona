import { useEffect, useState } from 'react'
import { Check, Loader2, RotateCcw, ShoppingCart } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { aHexLargo, contraste, esColorValido, tintaSobre } from '../../lib/color'
import { extraerMensajeError } from '../../lib/errors'
import { useComercioConfig, useUpdateComercioConfig } from './api'

/** El azul del tema (index.css). Es lo que se usa cuando el comercio no eligió
 * ninguno, y el botón de "volver al original" vuelve acá. */
const COLOR_DEL_TEMA = '#2f8fff'

/** Presets probados sobre el fondo negro del tema. No es una paleta cerrada
 * —abajo se puede tipear cualquier hex— pero evita que el 90% de los casos
 * tenga que pelear con un selector de color. */
const PRESETS: { hex: string; nombre: string }[] = [
  { hex: COLOR_DEL_TEMA, nombre: 'Azul' },
  { hex: '#00e0a8', nombre: 'Verde agua' },
  { hex: '#22c55e', nombre: 'Verde' },
  { hex: '#ffc21a', nombre: 'Amarillo' },
  { hex: '#f97316', nombre: 'Naranja' },
  { hex: '#ef4444', nombre: 'Rojo' },
  { hex: '#ec4899', nombre: 'Rosa' },
  { hex: '#a855f7', nombre: 'Violeta' },
]

/** Cómo se va a ver el color en lo que de verdad pinta, sin tener que guardar
 * para enterarse. */
function Muestra({ color }: { color: string }) {
  const tinta = tintaSobre(color)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-4">
      <span
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
        style={{ background: color, color: tinta }}
      >
        <ShoppingCart size={15} /> Cobrar
      </span>
      <span
        className="rounded-lg px-3 py-2 text-sm font-medium"
        style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
      >
        Ítem activo del menú
      </span>
      <span
        className="rounded-lg border bg-surface-2 px-3 py-2 text-sm text-text"
        style={{ borderColor: color, boxShadow: `0 0 0 1px ${color}` }}
      >
        Campo con foco
      </span>
      <span className="tabular-nums text-sm font-semibold" style={{ color }}>$ 12.480,00</span>
    </div>
  )
}

export function Apariencia() {
  const { toast } = useToast()
  const { data: comercio, isLoading } = useComercioConfig()
  const actualizar = useUpdateComercioConfig()
  const { refrescarUsuario } = useAuth()

  const [color, setColor] = useState(COLOR_DEL_TEMA)

  useEffect(() => {
    if (comercio) setColor(comercio.color_acento || COLOR_DEL_TEMA)
  }, [comercio])

  const valido = esColorValido(color)
  const elegido = valido ? (aHexLargo(color) as string) : COLOR_DEL_TEMA
  // Contra el fondo del tema: un acento muy oscuro se pierde y no sirve para
  // resaltar nada, que es justo para lo que está.
  const contrasteFondo = contraste(elegido, '#08080a')

  async function guardar(hex: string) {
    try {
      await actualizar.mutateAsync({ color_acento: hex })
      // El shell pinta la app con lo que trae /auth/me/, así que hay que
      // releerlo para que el color nuevo se aplique sin recargar la página.
      await refrescarUsuario()
      toast(hex ? 'Color aplicado' : 'Volvió el color original')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar el color'), 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-text-dim">
        <Loader2 size={16} className="animate-spin" /> Cargando…
      </div>
    )
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <p className="text-sm text-text-dim">
        Elegí el color de tu marca. Pinta lo que el sistema resalta: el botón principal, el ítem activo
        del menú, el foco de los campos y las barras de los gráficos. El verde, el ámbar y el rojo no se
        tocan — significan <span className="text-accent-2">salió bien</span>,{' '}
        <span className="text-warning">ojo</span> y <span className="text-danger">error</span>, y cambiarlos
        rompería esa lectura.
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const activo = elegido.toLowerCase() === preset.hex.toLowerCase()
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => setColor(preset.hex)}
              title={preset.nombre}
              aria-label={preset.nombre}
              aria-pressed={activo}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-transform hover:scale-105 ${
                activo ? 'border-text' : 'border-transparent'
              }`}
              style={{ background: preset.hex }}
            >
              {activo && <Check size={18} strokeWidth={3} style={{ color: tintaSobre(preset.hex) }} />}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* type="color" nativo: el selector del sistema operativo ya resuelve
            esto mejor que cualquier rueda que dibujemos nosotros. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="color-rueda" className="text-xs font-medium uppercase tracking-wide text-text-dim">
            Otro color
          </label>
          <input
            id="color-rueda" type="color"
            value={elegido}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-surface-2 p-1"
          />
        </div>
        <Input
          id="color-hex" label="Código" placeholder="#2f8fff"
          value={color} onChange={(e) => setColor(e.target.value)}
          className="w-32 font-mono"
        />
        {!valido && color.trim() !== '' && (
          <p className="pb-2 text-xs text-danger">No es un color válido. Va como #2f8fff.</p>
        )}
      </div>

      <Muestra color={elegido} />

      {contrasteFondo < 3 && (
        <p className="text-xs text-warning">
          Ojo: este color casi no se distingue del fondo negro de la app, así que lo que resalte va a
          pasar desapercibido. Probá uno más claro.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => guardar(elegido)} disabled={!valido || actualizar.isPending}>
          {actualizar.isPending && <Loader2 size={14} className="animate-spin" />}
          Guardar color
        </Button>
        <Button
          type="button" variant="ghost"
          onClick={() => { setColor(COLOR_DEL_TEMA); guardar('') }}
          disabled={actualizar.isPending}
        >
          <RotateCcw size={15} /> Volver al original
        </Button>
      </div>

      <p className="text-xs text-text-dim">
        El color es de esta sucursal y lo ven todos los que trabajan en ella, en cualquier dispositivo.
      </p>
    </div>
  )
}
