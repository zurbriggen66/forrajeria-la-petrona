import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Brand } from '../components/Brand'

export function LoginPage() {
  const { user, login } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? '/home'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      toast('Bienvenido a TIENDA-IA')
      navigate('/home', { replace: true })
    } catch {
      setError('Usuario o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fondo-tecnico relative flex min-h-svh items-center justify-center overflow-hidden bg-bg px-4">
      <div
        aria-hidden
        className="ambient-blob pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-brand opacity-[0.12] blur-[120px]"
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-8 glow-accent">
        <div className="mb-7 flex flex-col items-center gap-3">
          <Brand />
          <span className="text-xs text-text-dim">Panel de gestión</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="username"
            label="Usuario"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2 justify-center">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  )
}
