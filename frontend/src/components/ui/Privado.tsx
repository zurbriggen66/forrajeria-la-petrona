import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from './Button'
import { usePrivacidad } from '../../context/PrivacidadContext'
import { TAPADO, esSensible } from '../../lib/privacidad'

/** Tapa el valor de una tarjeta mientras el modo privado esté activo.
 *
 * Está adentro de KpiCard, StatCard y MetricCard, así que alcanza con prender
 * el modo para que se tape toda la plata resumida de la app. El POS no usa
 * estas tarjetas a propósito: ahí el total tiene que verse, es lo que el
 * cliente está por pagar. */
export function Privado({ children }: { children: ReactNode }) {
  const { oculto } = usePrivacidad()
  if (!oculto || !esSensible(children)) return <>{children}</>
  return (
    <span className="select-none tracking-widest text-text-dim" title="Modo privado activo">
      {TAPADO}
    </span>
  )
}

/** Lo que se ve en lugar de una pantalla que es sólo números.
 *
 * Las pantallas de estadísticas se tapan enteras y no valor por valor: además
 * de las tarjetas tienen gráficos, tooltips y frases con montos adentro
 * ("Resultado $ 480.000 → se le resta lo fiado…"). Tapar cada uno deja siempre
 * alguno afuera, y un modo privado que se olvida de uno no sirve para nada:
 * el dueño lo prende creyendo que no se ve nada y el gráfico sigue ahí. */
export function PantallaOculta() {
  const { alternar } = usePrivacidad()
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface px-6 py-20 text-center">
      <span className="rounded-2xl bg-surface-2 p-4 text-text-dim">
        <EyeOff size={28} />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-text">Los números están ocultos</p>
        <p className="mt-1 text-sm text-text-dim">
          El modo privado está activo. Nadie que mire la pantalla ve tu facturación.
        </p>
      </div>
      <Button variant="secondary" onClick={alternar}>
        <Eye size={14} /> Mostrar los números
      </Button>
    </div>
  )
}
