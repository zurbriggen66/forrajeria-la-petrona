import { Loader2, RotateCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Table, type Column } from '../../components/ui/Table'
import { useToast } from '../../context/ToastContext'
import { extraerMensajeError } from '../../lib/errors'
import { useColaFiscal, useFacturarVenta, useProcesarPendientes } from './api'
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
  const procesar = useProcesarPendientes()
  const { toast } = useToast()

  // Las que quedaron sin CAE: o ARCA falló al cobrar (facturación automática)
  // o el comprobante fue rechazado. Se reintentan todas juntas.
  const pendientes = (cola ?? []).filter((i) => i.status === 'pendiente' || i.status === 'error')

  async function procesarTodas() {
    try {
      const r = await procesar.mutateAsync()
      if (r.emitidas === 0 && r.fallidas === 0) {
        toast('No había comprobantes pendientes')
      } else if (r.fallidas === 0) {
        toast(`${r.emitidas} comprobante${r.emitidas === 1 ? '' : 's'} emitido${r.emitidas === 1 ? '' : 's'}`)
      } else {
        toast(`${r.emitidas} emitidos, ${r.fallidas} siguen fallando: ${r.errores[0] ?? ''}`, 'error')
      }
    } catch (err) {
      toast(extraerMensajeError(err, 'No se pudieron procesar los pendientes'), 'error')
    }
  }

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
      render: (i) => (i.error_msg ? <span className="text-danger">{i.error_msg}</span> : '—'),
    },
    {
      header: '',
      className: 'text-right',
      render: (i) =>
        (i.status === 'error' || i.status === 'pendiente') && (
          <Button variant="secondary" onClick={() => reintentar(i)} disabled={facturar.isPending}>
            <RotateCw size={13} /> Reintentar
          </Button>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-dim">
          Comprobantes electrónicos enviados a ARCA. Los que quedaron sin CAE — porque ARCA no
          respondía al cobrar, o porque rechazó el comprobante — se pueden reintentar.
        </p>
        {pendientes.length > 0 && (
          <Button onClick={procesarTodas} disabled={procesar.isPending} className="shrink-0">
            {procesar.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
            Facturar {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}
          </Button>
        )}
      </div>
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
