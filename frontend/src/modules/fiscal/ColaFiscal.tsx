import { Loader2, RotateCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useColaFiscal, useFacturarVenta } from './api'
import type { FiscalQueueItem } from './types'

const ESTADO_ESTILO: Record<FiscalQueueItem['status'], string> = {
  ok: 'border-accent-2/40 text-accent-2',
  error: 'border-danger/40 text-danger',
  procesando: 'border-warning/40 text-warning',
  pendiente: 'border-border text-text-dim',
}

const ESTADO_LABEL: Record<FiscalQueueItem['status'], string> = {
  ok: 'CAE obtenido',
  error: 'Rechazado',
  procesando: 'Procesando',
  pendiente: 'Pendiente',
}

export function ColaFiscal() {
  const { data: cola, isLoading } = useColaFiscal()
  const facturar = useFacturarVenta()
  const { toast } = useToast()

  async function reintentar(item: FiscalQueueItem) {
    try {
      await facturar.mutateAsync(item.venta)
      toast('CAE obtenido correctamente')
    } catch (err) {
      toast(extraerMensajeError(err, 'ARCA volvió a rechazar el comprobante'), 'error')
    }
  }

  const columns: Column<FiscalQueueItem>[] = [
    { header: 'Ticket', render: (i) => (i.venta_numero_ticket ? `#${i.venta_numero_ticket}` : '—') },
    {
      header: 'Estado',
      render: (i) => (
        <span className={`rounded-full border px-2 py-0.5 text-xs ${ESTADO_ESTILO[i.status]}`}>
          {ESTADO_LABEL[i.status]}
        </span>
      ),
    },
    { header: 'CAE', render: (i) => i.cae || '—' },
    { header: 'Comprobante', render: (i) => (i.numero_factura ? `${i.punto_venta}-${i.numero_factura}` : '—') },
    {
      header: 'Motivo',
      render: (i) => (i.status === 'error' ? <span className="text-danger">{i.error_msg}</span> : '—'),
    },
    {
      header: '',
      className: 'text-right',
      render: (i) =>
        i.status === 'error' && (
          <Button variant="secondary" onClick={() => reintentar(i)} disabled={facturar.isPending}>
            <RotateCw size={13} /> Reintentar
          </Button>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-dim">
        Comprobantes electrónicos enviados a ARCA. Los que quedaron rechazados se pueden reintentar
        una vez corregido el motivo.
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-dim">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <Table columns={columns} rows={cola ?? []} rowKey={(i) => i.id} emptyMessage="Todavía no se facturó ninguna venta." />
      )}
    </div>
  )
}
