import { useEffect, useState, type FormEvent } from 'react'
import {
  Check, CircleUserRound, Download, Loader2, MessageCircle,
  Plus, QrCode, Receipt, Sparkles, Trash2, UserRound,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useFiscalConfig, useGuardarFiscalConfig } from '../fiscal/api'
import { ColaFiscal } from '../fiscal/ColaFiscal'
import { CONDICIONES_IVA, MEDIOS_FACTURABLES } from '../fiscal/types'
import { CuentaAsistente } from '../asistente/CuentaAsistente'
import { InvitarUsuarioModal } from './InvitarUsuarioModal'
import {
  useActualizarRolUsuario,
  useCambiarPassword,
  useCambiarUsuario,
  useComercioConfig,
  useDescargarRespaldo,
  useDesconectarWhatsApp,
  useEstadoWhatsApp,
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

function MiCuenta() {
  const { toast } = useToast()
  const { user, refrescarUsuario } = useAuth()
  const cambiarUsuario = useCambiarUsuario()
  const cambiarPassword = useCambiarPassword()

  const [username, setUsername] = useState(user?.username ?? '')
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')

  useEffect(() => setUsername(user?.username ?? ''), [user?.username])

  async function handleUsuario(e: FormEvent) {
    e.preventDefault()
    try {
      await cambiarUsuario.mutateAsync(username)
      await refrescarUsuario()
      toast('Nombre de usuario actualizado')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cambiar el usuario'), 'error')
    }
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault()
    if (passwordNueva !== passwordConfirmar) {
      toast('Las contraseñas nuevas no coinciden', 'error')
      return
    }
    try {
      await cambiarPassword.mutateAsync({ password_actual: passwordActual, password_nueva: passwordNueva })
      toast('Contraseña actualizada')
      setPasswordActual('')
      setPasswordNueva('')
      setPasswordConfirmar('')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo cambiar la contraseña'), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleUsuario} className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <Input
            id="mi-usuario" label="Nombre de usuario (para iniciar sesión)" value={username}
            onChange={(e) => setUsername(e.target.value)} className="max-w-xs"
          />
          <Button type="submit" variant="secondary" disabled={cambiarUsuario.isPending || username === user?.username}>
            {cambiarUsuario.isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar usuario
          </Button>
        </div>
      </form>

      <form onSubmit={handlePassword} className="flex flex-col gap-3">
        <div className="grid max-w-2xl grid-cols-3 gap-4">
          <Input
            id="password-actual" label="Contraseña actual" type="password" required
            value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)}
          />
          <Input
            id="password-nueva" label="Contraseña nueva" type="password" required minLength={6}
            value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)}
          />
          <Input
            id="password-confirmar" label="Confirmar contraseña nueva" type="password" required minLength={6}
            value={passwordConfirmar} onChange={(e) => setPasswordConfirmar(e.target.value)}
          />
        </div>
        <div>
          <Button type="submit" disabled={cambiarPassword.isPending}>
            {cambiarPassword.isPending && <Loader2 size={14} className="animate-spin" />}
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </div>
  )
}

const LABEL_ESTADO_WHATSAPP: Record<string, string> = {
  conectado: 'Conectado',
  esperando_qr: 'Esperando que escanees el código',
  desconectado: 'Desconectado',
  conectando: 'Conectando…',
  no_configurado: 'El bot de WhatsApp no está configurado en este servidor',
  sin_conexion: 'No se pudo conectar con el bot de WhatsApp',
}

function EstadoWhatsApp() {
  const { toast } = useToast()
  const { data, isLoading } = useEstadoWhatsApp()
  const desconectar = useDesconectarWhatsApp()

  async function handleDesconectar() {
    if (!window.confirm('¿Desvincular WhatsApp? Vas a tener que escanear un código QR nuevo desde el celular que uses de ahora en más.')) return
    try {
      await desconectar.mutateAsync()
      toast('WhatsApp desvinculado — escaneá el código nuevo cuando aparezca')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo desvincular WhatsApp'), 'error')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-10 text-text-dim"><Loader2 size={16} className="animate-spin" /> Consultando…</div>
  }

  const estado = data?.estado ?? 'sin_conexion'

  if (estado === 'conectado') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-2/40 bg-accent-2/10 px-4 py-3 text-sm text-accent-2">
        <span className="flex items-center gap-2">
          <Check size={16} /> WhatsApp conectado — los avisos (fiado, etc.) se envían por acá.
        </span>
        <button
          onClick={handleDesconectar} disabled={desconectar.isPending}
          className="flex items-center gap-1.5 text-accent-2/80 hover:text-danger hover:underline"
        >
          {desconectar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Desvincular (para cambiar de celular)
        </button>
      </div>
    )
  }

  if (estado === 'esperando_qr' && data?.qr) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-6">
        <p className="flex items-center gap-1.5 text-sm text-text-dim">
          <QrCode size={15} /> Abrí WhatsApp en el celular del negocio → Dispositivos vinculados → Vincular
          un dispositivo, y escaneá este código.
        </p>
        <img src={data.qr} alt="Código QR para vincular WhatsApp" className="h-56 w-56 rounded-lg bg-white p-2" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
      <MessageCircle size={16} /> {LABEL_ESTADO_WHATSAPP[estado] ?? 'Estado desconocido'}
    </div>
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

/** Qué ventas se facturan solas al cobrarlas. Vive aparte de "Datos fiscales"
 * porque es una decisión operativa (cuándo emitir), no de identidad fiscal. */
function FacturacionAutomatica() {
  const { toast } = useToast()
  const { data: config, isLoading } = useFiscalConfig()
  const guardar = useGuardarFiscalConfig()

  const [activo, setActivo] = useState(false)
  const [medios, setMedios] = useState<string[]>([])
  const [minimo, setMinimo] = useState('0')

  useEffect(() => {
    if (config) {
      setActivo(config.facturar_automatico)
      setMedios(config.facturar_medios ?? [])
      setMinimo(String(Number(config.facturar_monto_minimo ?? 0)))
    }
  }, [config])

  function alternarMedio(valor: string) {
    setMedios((prev) => (prev.includes(valor) ? prev.filter((m) => m !== valor) : [...prev, valor]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (activo && medios.length === 0) {
      toast('Elegí al menos un medio de pago, o apagá la facturación automática', 'error')
      return
    }
    try {
      await guardar.mutateAsync({
        id: config?.id,
        facturar_automatico: activo,
        facturar_medios: medios,
        facturar_monto_minimo: minimo || '0',
      })
      toast('Facturación automática guardada')
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudo guardar'), 'error')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-10 text-text-dim"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  }

  if (!config) {
    return (
      <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
        Primero cargá los datos fiscales (CUIT y punto de venta) arriba.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex items-start gap-2.5 text-sm text-text">
        <input
          type="checkbox" className="mt-0.5 accent-accent"
          checked={activo} onChange={(e) => setActivo(e.target.checked)}
        />
        <span>
          Facturar automáticamente al cobrar
          <span className="mt-0.5 block text-xs text-text-dim">
            Cuando la venta cumple la regla de abajo, el sistema pide el CAE solo, sin apretar "Facturar".
          </span>
        </span>
      </label>

      {activo && (
        <>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-text-dim">
              Facturar las ventas cobradas por
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {MEDIOS_FACTURABLES.map((m) => {
                const elegido = medios.includes(m.value)
                return (
                  <button
                    key={m.value} type="button" onClick={() => alternarMedio(m.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      elegido
                        ? 'border-accent/50 bg-accent/15 text-accent'
                        : 'border-border text-text-dim hover:border-accent/40 hover:text-text'
                    }`}
                  >
                    {elegido && <Check size={13} className="mr-1.5 inline" />}
                    {m.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-text-dim">
              Si una venta se cobró con varios medios, alcanza con que uno esté marcado: lo que entró
              por transferencia o tarjeta ya quedó registrado.
            </p>
          </div>

          <Input
            id="facturar-minimo" label="Facturar solo si supera (opcional)" type="number" min="0" step="0.01"
            value={minimo} onChange={(e) => setMinimo(e.target.value)} className="max-w-xs"
          />
          <p className="-mt-2 text-xs text-text-dim">Dejalo en 0 para facturar sin importar el monto.</p>
        </>
      )}

      <p className="text-xs text-text-dim">
        Si ARCA no responde en el momento, la venta igual se cobra y queda pendiente en
        "Facturación electrónica" para reintentar con un botón.
      </p>

      <div>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 size={14} className="animate-spin" />}
          Guardar facturación automática
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

type Pestaña = 'cuenta' | 'fiscal' | 'whatsapp' | 'ia' | 'respaldo'

const TODAS_LAS_TABS: { key: Pestaña; label: string; icon: typeof CircleUserRound }[] = [
  { key: 'cuenta', label: 'Mi cuenta', icon: CircleUserRound },
  { key: 'fiscal', label: 'Fiscal', icon: Receipt },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'ia', label: 'IA', icon: Sparkles },
  { key: 'respaldo', label: 'Respaldo', icon: Download },
]

export function Config() {
  const { user } = useAuth()
  const esDueño = user?.rol === 'Dueño'
  // Cajero/Repositor sólo tienen algo que hacer en "Mi cuenta" (su usuario y
  // contraseña) y en "Respaldo"; el resto es infraestructura del comercio.
  const tabs = esDueño ? TODAS_LAS_TABS : TODAS_LAS_TABS.filter((t) => t.key === 'cuenta' || t.key === 'respaldo')
  const [tab, setTab] = useState<Pestaña>('cuenta')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'cuenta' && (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold text-text">Datos del comercio</h2>
            <DatosDelComercio />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold text-text">Mi usuario</h2>
            <MiCuenta />
          </section>

          {esDueño && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-sm font-semibold text-text">Usuarios</h2>
              <Usuarios />
            </section>
          )}
        </div>
      )}

      {tab === 'fiscal' && esDueño && (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold text-text">Datos fiscales</h2>
            <DatosFiscales />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold text-text">Facturación automática</h2>
            <FacturacionAutomatica />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-sm font-semibold text-text">Facturación electrónica</h2>
            <ColaFiscal />
          </section>
        </div>
      )}

      {tab === 'whatsapp' && esDueño && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold text-text">WhatsApp</h2>
          <EstadoWhatsApp />
        </section>
      )}

      {tab === 'ia' && esDueño && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold text-text">Asistente con IA</h2>
          <CuentaAsistente />
        </section>
      )}

      {tab === 'respaldo' && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold text-text">Respaldo</h2>
          <Respaldo />
        </section>
      )}
    </div>
  )
}
