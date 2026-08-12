import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export function BarcodeLabel({ value, height = 36 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', height, displayValue: false, margin: 0 })
    } catch {
      // Código con caracteres no soportados por CODE128 (dato legacy poco común): se omite el dibujo.
    }
  }, [value, height])

  if (!value) {
    return <div className="flex h-9 items-center justify-center text-[10px] text-text-dim">Sin código de barras</div>
  }
  return <svg ref={ref} className="w-full" />
}
