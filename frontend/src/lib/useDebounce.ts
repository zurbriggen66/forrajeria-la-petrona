import { useEffect, useState } from 'react'

/** Retrasa la propagación de un valor que cambia muy seguido.
 *
 * Los buscadores del sistema disparan una request por tecla: escribir
 * "balanceado" eran 10 llamadas al servidor, y las respuestas podían llegar
 * desordenadas y pisar el resultado bueno. Con esto se hace una sola, cuando
 * el usuario dejó de tipear. */
export function useDebounce<T>(valor: T, ms = 350): T {
  const [diferido, setDiferido] = useState(valor)

  useEffect(() => {
    const id = setTimeout(() => setDiferido(valor), ms)
    return () => clearTimeout(id)
  }, [valor, ms])

  return diferido
}
