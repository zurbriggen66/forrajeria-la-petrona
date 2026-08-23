"""Emisión de comprobantes: un solo camino para las tres formas de facturar.

Lo usan el botón manual (VentaViewSet.facturar), la facturación automática al
cobrar (según ComercioFiscalConfig) y el reintento en lote de la Cola Fiscal.
Tenerlo en un solo lugar evita que las tres queden escribiendo distinto la
venta y la cola.
"""
from django.db import transaction
from django.utils import timezone

from .afip import ErrorFiscal, solicitar_cae
from .models import ComercioFiscalConfig, FiscalQueue


def config_vigente(comercio):
    """Configuración fiscal activa del comercio (la principal si hay varias)."""
    return (
        ComercioFiscalConfig.objects.filter(comercio=comercio, activo=True)
        .order_by("-es_principal")
        .first()
    )


def emitir_factura(venta, config):
    """Pide el CAE y deja la venta y la cola coherentes.

    Relanza ErrorFiscal si ARCA rechaza o no responde, dejando el ítem de la
    cola en "error" con el motivo. No captura la excepción a propósito: quien
    llama decide si es un error para el usuario (botón manual) o algo que no
    debe romper la venta (facturación automática).

    Todo lo que quedó en "error" es reintentable desde la Cola Fiscal — sea
    porque ARCA estaba caído o porque rechazó el comprobante; el motivo
    guardado distingue un caso del otro.
    """
    comercio = venta.comercio
    cola, _ = FiscalQueue.objects.update_or_create(
        comercio=comercio, venta=venta,
        defaults={"status": "procesando", "error_msg": ""},
    )

    try:
        resultado = solicitar_cae(venta, config)
    except ErrorFiscal as exc:
        cola.status = "error"
        cola.error_msg = str(exc)
        cola.save(update_fields=["status", "error_msg", "updated_at"])
        raise

    with transaction.atomic():
        venta.facturado = True
        venta.cae = resultado["cae"]
        venta.cae_vencimiento = resultado["cae_vencimiento"]
        venta.numero_factura = str(resultado["numero"])
        venta.punto_venta_factura = str(resultado["punto_vta"])
        venta.tipo_factura = str(resultado["tipo_cbte"])
        venta.fecha_facturacion = timezone.now()
        venta.save(update_fields=[
            "facturado", "cae", "cae_vencimiento", "numero_factura",
            "punto_venta_factura", "tipo_factura", "fecha_facturacion", "updated_at",
        ])

        cola.status = "ok"
        cola.cae = resultado["cae"]
        cola.cae_vencimiento = resultado["cae_vencimiento"]
        cola.punto_venta = str(resultado["punto_vta"])
        cola.numero_factura = str(resultado["numero"])
        cola.tipo_comprobante = str(resultado["tipo_cbte"])
        cola.error_msg = ""
        cola.save(update_fields=[
            "status", "cae", "cae_vencimiento", "punto_venta",
            "numero_factura", "tipo_comprobante", "error_msg", "updated_at",
        ])

    return venta


def facturar_si_corresponde(venta):
    """Facturación automática al cobrar.

    Nunca relanza: la venta YA está cobrada y guardada, y un problema con ARCA
    no puede hacerla fallar hacia atrás. Si no se pudo emitir, queda en la cola
    para reintentar desde Config > Facturación electrónica.

    Devuelve True sólo si se emitió el CAE.
    """
    config = config_vigente(venta.comercio)
    if config is None or not config.debe_facturarse(venta):
        return False
    try:
        emitir_factura(venta, config)
        return True
    except ErrorFiscal:
        return False
    except Exception:  # noqa: BLE001
        # Cualquier otra cosa (bug en el wrapper, timeout raro de la librería):
        # tampoco puede tumbar una venta ya cobrada.
        FiscalQueue.objects.update_or_create(
            comercio=venta.comercio, venta=venta,
            defaults={"status": "error", "error_msg": "Error inesperado al facturar."},
        )
        return False
