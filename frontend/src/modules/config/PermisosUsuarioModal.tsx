import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { MODULOS_OPCIONALES } from '../../router/navigation'
import { useActualizarUsuario } from './api'
import type { UsuarioComercio } from './types'

/** Qué módulos ve cada empleado. Se guarda lo BLOQUEADO (ver
 * core/modulos.py), pero acá se muestra al derecho: tildado = habilitado, que
 * es como lo piensa el dueño. */
export function PermisosUsuarioModal({ usuario, onClose }: { usuario: UsuarioComercio; onClose: () => void }) {
  const { toast } = useToast()
  const actualizar = useActualizarUsuario()
  const [bloqueados, setBloqueados] = useState<string[]>(usuario.modulos_bloqueados ?? [])

  const esDueño = usuario.rol === 'Dueño'

  function alternar(path: string) {
    setBloqueados((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]))
  }

  async function guardar() {
    try {
      await actualizar.mutateAsync({ id: usuario.id, modulos_bloqueados: bloqueados })
      toast('Permisos guardados')
      onClose()
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudieron guardar los permisos'), 'error')
    }
  }

  return (
    <Modal title={`Permisos de ${usuario.nombre_completo || usuario.email}`} onClose={onClose}>
      {esDueño ? (
        <p className="text-sm text-text-dim">
          El Dueño ve todos los módulos siempre. Cambiale el rol si querés limitarle el acceso.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-dim">Destildá lo que no querés que vea.</p>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-text-dim hover:text-accent" onClick={() => setBloqueados([])}>
                Marcar todo
              </button>
              <button
                type="button" className="text-text-dim hover:text-accent"
                onClick={() => setBloqueados(MODULOS_OPCIONALES.map((m) => m.path))}
              >
                Desmarcar todo
              </button>
            </div>
          </div>

          <div className="grid max-h-[50vh] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {MODULOS_OPCIONALES.map((modulo) => {
              const habilitado = !bloqueados.includes(modulo.path)
              const Icono = modulo.icon
              return (
                <label
                  key={modulo.path}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text hover:bg-surface-2"
                >
                  <input type="checkbox" checked={habilitado} onChange={() => alternar(modulo.path)} />
                  <Icono size={15} className="shrink-0 text-text-dim" />
                  {modulo.label}
                </label>
              )
            })}
          </div>

          <p className="text-xs text-text-dim">
            Inicio y Config quedan siempre habilitados: sin Inicio entra a una pantalla vacía, y en
            Config sólo ve su usuario y su contraseña. Vender igual necesita leer productos y
            clientes, así que apagar esos módulos le saca la pantalla del menú pero no le rompe el POS.
          </p>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={guardar} disabled={actualizar.isPending}>
              {actualizar.isPending && <Loader2 size={14} className="animate-spin" />}
              Guardar permisos
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
