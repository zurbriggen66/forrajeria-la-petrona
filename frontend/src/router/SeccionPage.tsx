import { useLocation } from 'react-router-dom'
import { SeccionTabs } from '../components/ui/SeccionTabs'
import { ModulePlaceholder } from '../modules/ModulePlaceholder'
import { MODULOS_IMPLEMENTADOS } from './modulos'
import { NAV_ITEMS } from './navigation'

/** Una sección de la barra que agrupa varias pantallas: las muestra como
 * pestañas dentro de la misma página, en vez de un menú flotante.
 *
 * Las pestañas salen de `children` en navigation.ts — una sola fuente de
 * verdad: agregar una sub-pantalla es sumarla ahí y registrar su componente
 * en modulos.ts, sin tocar este archivo.
 */
export function SeccionPage() {
  const { pathname } = useLocation()

  const item = NAV_ITEMS.find(
    (i) => i.children?.length && (i.path === pathname || pathname.startsWith(i.path + '/')),
  )
  if (!item?.children?.length) return null

  // Entrando por la ruta padre (ej. /caja) no matchea ninguna hija: se abre
  // la primera pestaña.
  const activo = item.children.find((c) => c.path === pathname) ?? item.children[0]
  const Modulo = MODULOS_IMPLEMENTADOS[activo.path]

  return (
    <div className="flex flex-col gap-5">
      <SeccionTabs items={item.children} activo={activo.path} />
      {Modulo ? <Modulo /> : <ModulePlaceholder nombre={activo.label} />}
    </div>
  )
}
