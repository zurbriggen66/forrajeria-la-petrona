import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const CLAVE = 'petrona:modo-privado'

/** Se recuerda por máquina: la que está de cara al público arranca tapada y la
 * de la oficina no, sin que nadie tenga que acordarse cada mañana.
 *
 * localStorage puede tirar excepción (modo privado del navegador, cookies
 * bloqueadas). Si falla, el modo privado sigue funcionando en la sesión — lo
 * único que se pierde es que se recuerde. No vale romper la app por esto. */
function leerGuardado(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

const PrivacidadContext = createContext<{ oculto: boolean; alternar: () => void }>({
  oculto: false,
  alternar: () => {},
})

export function PrivacidadProvider({ children }: { children: ReactNode }) {
  const [oculto, setOculto] = useState(leerGuardado)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, oculto ? '1' : '0')
    } catch {
      // Ver leerGuardado: que no se recuerde no es motivo para cortar nada.
    }
  }, [oculto])

  return (
    <PrivacidadContext.Provider value={{ oculto, alternar: () => setOculto((v) => !v) }}>
      {children}
    </PrivacidadContext.Provider>
  )
}

export function usePrivacidad() {
  return useContext(PrivacidadContext)
}
