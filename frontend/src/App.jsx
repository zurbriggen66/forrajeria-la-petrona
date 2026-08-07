import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/health/')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setStatus('connected')
        setMessage(data.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message)
      })
  }, [])

  return (
    <section id="center">
      <h1>Forrajeria La Petrona</h1>
      <div className={`status-badge status-${status}`}>
        {status === 'checking' && 'Conectando con el backend...'}
        {status === 'connected' && `✅ Backend conectado: ${message}`}
        {status === 'error' && `❌ No se pudo conectar al backend: ${message}`}
      </div>
    </section>
  )
}

export default App
