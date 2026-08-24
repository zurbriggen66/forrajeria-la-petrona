import { useComercioConfig } from '../../modules/config/api'

/** Encabezado común de todo lo que se imprime: quién emite el papel.
 *
 * Sale de los datos del comercio (Configuración → Mi cuenta), así que si el
 * cliente cambia de dirección o teléfono no hay que tocar código ni reimprimir
 * talonarios. */
export function Membrete({ titulo, numero, fecha }: {
  titulo: string
  numero?: string
  fecha: string
}) {
  const { data: comercio } = useComercioConfig()

  return (
    <header className="hoja-membrete">
      <div>
        <p className="hoja-comercio">{comercio?.nombre ?? ''}</p>
        <p className="hoja-datos">
          {[comercio?.direccion, comercio?.telefono].filter(Boolean).join(' · ')}
        </p>
        {comercio?.cuit && <p className="hoja-datos">CUIT {comercio.cuit}</p>}
      </div>
      <div className="hoja-titulo-bloque">
        <p className="hoja-titulo">{titulo}</p>
        {numero && <p className="hoja-numero">N° {numero}</p>}
        <p className="hoja-datos">{fecha}</p>
      </div>
    </header>
  )
}
