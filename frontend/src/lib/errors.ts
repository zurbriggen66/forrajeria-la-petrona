import axios from 'axios'

/** Claves que DRF usa de envoltorio y que al usuario no le dicen nada. */
const ENVOLTORIOS = new Set(['detail', 'non_field_errors', 'items', 'pagos', 'productos'])

/** Cuántos mensajes se muestran antes de resumir: un toast con veinte
 * renglones no se lee, y con arreglar el primero suele alcanzar. */
const MAX_MENSAJES = 3

/** Nombres de campo que el humanizador automático deja peor de lo que están.
 * Corto a propósito: `costo_unitario` ya sale bien como "Costo unitario", y una
 * tabla con todos los campos del sistema se desactualiza sola. */
const ETIQUETAS: Record<string, string> = {
  cuenta_pago: 'Medio de pago',
  vuelto_cuenta_pago: 'Cuenta del vuelto',
  monto_cuenta_corriente: 'Monto fiado',
  descuento_pct: 'Descuento',
  es_bolsa: 'Presentación',
  sync_uuid: 'Identificador de la venta',
  combo: 'Pack',
  numero_factura: 'N° de factura',
  fecha_vencimiento: 'Vencimiento',
  color_acento: 'Color',
  modulos_bloqueados: 'Módulos',
  username: 'Nombre de usuario',
  password: 'Contraseña',
}

/** DRF le habla al programador, no al que está atendiendo el mostrador.
 * "Asegúrese de que no haya más de 3 decimales" es correcto y es inútil: no
 * dice qué hacer. Acá cada mensaje de la librería se cambia por uno que sí.
 *
 * Los mensajes que escribimos nosotros en el backend ("No hay stock suficiente
 * de X", "No hay una caja abierta") NO están en esta tabla y pasan tal cual:
 * ya están escritos para el usuario y nombran la cosa concreta. */
const TRADUCCIONES: { patron: RegExp; texto: (m: RegExpMatchArray) => string }[] = [
  {
    patron: /^Se requiere un n[úu]mero v[áa]lido/i,
    texto: () => 'Tiene que ser un número. Quedó vacío o con letras.',
  },
  {
    patron: /^Introduzca un n[úu]mero entero v[áa]lido/i,
    texto: () => 'Tiene que ser un número entero, sin decimales.',
  },
  {
    patron: /no haya m[áa]s de (\d+) decimales/i,
    texto: (m) => `Como mucho ${m[1]} decimal${m[1] === '1' ? '' : 'es'}. Redondeá el número.`,
  },
  {
    patron: /no haya m[áa]s de (\d+) d[íi]gitos en total/i,
    texto: (m) => `El número es demasiado largo: hasta ${m[1]} dígitos.`,
  },
  {
    patron: /este valor es mayor o igual a (\d+(?:[.,]\d+)?)/i,
    texto: (m) => `Tiene que ser ${m[1]} o más.`,
  },
  {
    patron: /este valor es menor o igual a (\d+(?:[.,]\d+)?)/i,
    texto: (m) => `No puede pasar de ${m[1]}.`,
  },
  {
    patron: /este campo no tenga m[áa]s de (\d+) caracteres/i,
    texto: (m) => `Es muy largo: hasta ${m[1]} caracteres.`,
  },
  {
    patron: /^Este campo (es requerido|no puede estar en blanco|no puede ser nulo)/i,
    texto: () => 'Falta completar este campo.',
  },
  {
    patron: /^Fecha con formato err[óo]neo|^Introduzca una fecha v[áa]lida/i,
    texto: () => 'La fecha no es válida. Elegila del calendario.',
  },
  {
    patron: /UUID v[áa]lido/i,
    texto: () => 'No se reconoce lo que elegiste. Volvé a elegirlo de la lista.',
  },
  {
    patron: /direcci[óo]n de correo electr[óo]nico v[áa]lida/i,
    texto: () => 'El email no es válido.',
  },
  {
    patron: /no es una opci[óo]n v[áa]lida/i,
    texto: () => 'Esa opción no existe. Elegí una de la lista.',
  },
  {
    patron: /ya existe/i,
    texto: () => 'Ya hay otro cargado con ese dato.',
  },
  {
    patron: /^No encontrado/i,
    texto: () => 'No se encontró. Puede que lo hayan borrado desde otra pantalla.',
  },
  {
    patron: /credenciales de autenticaci[óo]n no se proveyeron|token.*(inv[áa]lido|expirad)/i,
    texto: () => 'Se cerró tu sesión. Volvé a entrar.',
  },
  {
    patron: /^Se esperab[ao] (un|una) (diccionario|lista)/i,
    texto: () => 'El dato llegó con una forma que el sistema no esperaba. Avisá que pasó esto.',
  },
]

/** `generico` = era un mensaje de la librería, sin contexto propio. En ese caso
 * conviene anteponerle el nombre del campo; los nuestros ya se explican solos y
 * ponerles "Monto:" adelante sólo agrega ruido. */
function traducir(mensaje: string): { texto: string; generico: boolean } {
  for (const { patron, texto } of TRADUCCIONES) {
    const m = mensaje.match(patron)
    if (m) return { texto: texto(m), generico: true }
  }
  return { texto: mensaje, generico: false }
}

function humanizar(campo: string) {
  if (ETIQUETAS[campo]) return ETIQUETAS[campo]
  const texto = campo.replace(/_/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "Fila 2 (Costo unitario): ".
 *
 * La fila va siempre que el error venga de un renglón: con veinte productos
 * cargados, saber CUÁL falló es la mitad del mensaje. El nombre del campo va
 * sólo cuando el mensaje es genérico y no lo dice él mismo. */
function prefijo(camino: string[], generico: boolean) {
  const indice = camino.find((clave) => /^\d+$/.test(clave))
  const campo = [...camino].reverse().find((c) => !/^\d+$/.test(c) && !ENVOLTORIOS.has(c))
  const etiqueta = generico && campo ? humanizar(campo) : null

  if (indice !== undefined) {
    return `Fila ${Number(indice) + 1}${etiqueta ? ` (${etiqueta})` : ''}: `
  }
  return etiqueta ? `${etiqueta}: ` : ''
}

function aplanar(valor: unknown, camino: string[]): string[] {
  if (typeof valor === 'string') {
    if (!valor.trim()) return []
    const { texto, generico } = traducir(valor.trim())
    return [prefijo(camino, generico) + texto]
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) =>
      // Una lista de textos son los mensajes de UN campo. Una lista de objetos
      // es un renglón por elemento, y ahí el índice sí es la fila.
      typeof v === 'string' ? aplanar(v, camino) : aplanar(v, [...camino, String(i)]),
    )
  }
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, v]) => aplanar(v, [...camino, clave]))
  }
  return []
}

/** DRF devuelve errores de validación como string, lista (`["msg"]`), objeto
 * por campo (`{"campo": ["msg"]}`) o —cuando el serializer tiene ítems
 * anidados— objeto por renglón (`{"items": {"0": {"cantidad": ["msg"]}}}`).
 *
 * Esto los aplana a un mensaje legible para el toast, nunca un genérico "no se
 * pudo…" que le esconde la razón real del rechazo. Antes se aplanaba con
 * `.flat(2)` y un filtro de strings, así que la forma anidada quedaba en NADA:
 * cargar una compra con un costo de cuatro decimales devolvía "No se pudo
 * registrar la compra" y el dueño no tenía forma de saber qué corregir.
 *
 * Además traduce los mensajes de la librería (ver TRADUCCIONES): tal como
 * vienen están escritos para el que programa, no para el que atiende. */
export function extraerMensajeError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data
    if (typeof data === 'string' && data.trim()) return traducir(data.trim()).texto

    const mensajes = [...new Set(aplanar(data, []))]
    if (mensajes.length > MAX_MENSAJES) {
      const resto = mensajes.length - MAX_MENSAJES
      return `${mensajes.slice(0, MAX_MENSAJES).join(' ')} (y ${resto} error${resto === 1 ? '' : 'es'} más)`
    }
    if (mensajes.length > 0) return mensajes.join(' ')

    // Sin cuerpo que interpretar: al menos decir si fue la red o el servidor,
    // que es la diferencia entre "reintentá" y "avisá que algo se rompió".
    if (!err.response) return 'No hubo respuesta del servidor. Revisá la conexión y reintentá.'
    if (err.response.status === 401) return 'Se cerró tu sesión. Volvé a entrar.'
    if (err.response.status === 403) return 'Tu usuario no tiene permiso para hacer esto.'
    if (err.response.status === 404) return 'No se encontró. Puede que lo hayan borrado desde otra pantalla.'
    if (err.response.status >= 500) {
      return `${fallback} Se rompió algo del lado del servidor (error ${err.response.status}) — no es culpa de lo que cargaste.`
    }
  }
  return fallback
}
