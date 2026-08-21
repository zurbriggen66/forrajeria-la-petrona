import { useEffect, useState, type FormEvent } from 'react'
import { Download, Loader2, Plus, Trash2, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useFiscalConfig, useGuardarFiscalConfig } from '../fiscal/api'
import { ColaFiscal } from '../fiscal/ColaFiscal'
import { CONDICIONES_IVA } from '../fiscal/types'
import { CuentaAsistente } from '../asistente/CuentaAsistente'
import { InvitarUsuarioModal } from './InvitarUsuarioModal'
import {
  useActualizarRolUsuario,
  useComercioConfig,
  useDescargarRespaldo,
  useQuitarUsuario,
  useUpdateComercioConfig,
  useUsuariosComercio,
} from './api'
import { ROLES } from './types'

function DatosDelComercio() {
  const { toast } = useToast()
  const { data: comercio, isLoading } = useComercioConfig()
  const actualizar = useUpdateComercioConfig()

  const [form, setForm] = useState({ nombre: '', cuit: '', direccion: '', telefono: '', email: '' })

  useEffect(() => {
    if (comercio) {
      setForm({
        nombre: comercio.nombre, cuit: comercio.cuit, direccion: comercio.direccion,
        telefono: comercio.telefono, email: comercio.email,
      })
    }
  }, [comercio])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await actualizar.mutateAsync(form)
      toast('Datos del comercio actualizados')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudieron guardar los cambios'), 'error')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-10 text-text-dim"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input id="nombre" label="Nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <Input id="cuit" label="CUIT" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
      </div>
      <Input id="direccion" label="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
      <div className="grid grid-cols-2 gap-4">
        <Input id="telefono" label="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
        <Input id="email" label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <Button type="submit" disabled={actualizar.isPending}>
          {actualizar.isPending && <Loader2 size={14} className="animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

function DatosFiscales() {
  const { toast } = useToast()
  const { data: config, isLoading } = useFiscalConfig()
  const guardar = useGuardarFiscalConfig()

  const [form, setForm] = useState({
    cuit: '', razon_social: '', punto_venta: '', condicion_iva: '', cert_ref: '', homologacion: true,
  })

  useEffect(() => {
    if (config) {
      setForm({
        cuit: config.cuit, razon_social: config.razon_social, punto_venta: config.punto_venta,
        condicion_iva: config.condicion_iva, cert_ref: config.cert_ref, homologacion: config.homologacion,
      })
    }
  }, [config])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await guardar.mutateAsync({ id: config?.id, ...form })
      toast('Datos fiscales guardados')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudieron guardar los datos fiscales'), 'error')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-10 text-text-dim"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input id="cuit-fiscal" label="CUIT" required value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
        <Input id="razon_social" label="Razón social" value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input id="punto_venta" label="Punto de venta" required value={form.punto_venta} onChange={(e) => setForm({ ...form, punto_venta: e.target.value })} />
        <Select id="condicion_iva" label="Condición frente al IVA" value={form.condicion_iva} onChange={(e) => setForm({ ...form, condicion_iva: e.target.value })}>
          <option value="">Elegí una opción…</option>
          {CONDICIONES_IVA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </div>
      <Input
        id="cert_ref" label="Referencia del certificado" value={form.cert_ref}
        onChange={(e) => setForm({ ...form, cert_ref: e.target.value })}
        placeholder="Nombre de archivo sin extensión (ej: forrajeria-la-petrona)"
      />
      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox" className="accent-accent"
          checked={form.homologacion} onChange={(e) => setForm({ ...form, homologacion: e.target.checked })}
        />
        Modo homologación (pruebas — no emite comprobantes reales)
      </label>
      <p className="text-xs text-text-dim">
        El certificado y la clave privada de ARCA no se cargan desde acá — los coloca quien
        administra el servidor en <code>backend/fiscal_certs/</code>, con el mismo nombre que la
        "Referencia del certificado".
      </p>
      <div>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 size={14} className="animate-spin" />}
          Guardar datos fiscales
        </Button>
      </div>
    </form>
  )
}

function Usuarios() {
  const { toast } = useToast()
  const { data: usuarios, isLoading } = useUsuariosComercio()
  const actualizarRol = useActualizarRolUsuario()
  const quitar = useQuitarUsuario()
  const [modalAbierto, setModalAbierto] = useState(false)

  async function handleQuitar(id: string) {
    try {
      await quitar.mutateAsync(id)
      toast('Usuario quitado del comercio')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo quitar el usuario'), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalAbierto(true)}><Plus size={15} /> Agregar usuario</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-text-dim"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">Usuario</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">Email</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-dim">Rol</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(usuarios ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-text-dim">Sin usuarios cargados.</td></tr>
              ) : (
                usuarios!.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text"><span className="flex items-center gap-2"><UserRound size={14} className="text-text-dim" /> {u.nombre_completo || '—'}</span></td>
                    <td className="px-4 py-3 text-text-dim">{u.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        id={`rol-${u.id}`}
                        value={u.rol}
                        onChange={(e) => actualizarRol.mutate({ id: u.id, rol: e.target.value })}
                        className="py-1"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleQuitar(u.id)} className="text-text-dim hover:text-danger" aria-label="Quitar usuario">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && <InvitarUsuarioModal onClose={() => setModalAbierto(false)} />}
    </div>
  )
}

function Respaldo() {
  const descargar = useDescargarRespaldo()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-dim">
        Descargá un archivo JSON con productos, clientes, proveedores y las últimas ventas de esta sucursal.
        Es un respaldo de lectura — no permite restaurar datos todavía.
      </p>
      <div>
        <Button variant="secondary" onClick={() => descargar.mutate()} disabled={descargar.isPending}>
          {descargar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={15} />}
          Descargar respaldo
        </Button>
      </div>
    </div>
  )
}

export function Config() {
  const { user } = useAuth()
  const esDueño = user?.rol === 'Dueño'

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-sm font-semibold text-text">Datos del comercio</h2>
        <DatosDelComercio />
      </section>

      {esDueño && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold text-text">Datos fiscales</h2>
          <DatosFiscales />
        </section>
      )}

      {esDueño && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold text-text">Facturación electrónica</h2>
          <ColaFiscal />
        </section>
      )}

      {esDueño && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold text-text">Usuarios</h2>
          <Usuarios />
        </section>
      )}

      {esDueño && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold text-text">Asistente con IA</h2>
          <CuentaAsistente />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-sm font-semibold text-text">Respaldo</h2>
        <Respaldo />
      </section>
    </div>
  )
}
