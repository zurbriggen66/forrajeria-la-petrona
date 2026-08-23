from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSet, resolver_comercio_activo

from .afip import ErrorFiscal
from .models import ComercioFiscalConfig, FiscalQueue
from .serializers import ComercioFiscalConfigSerializer, FiscalQueueSerializer
from .services import config_vigente, emitir_factura


class ComercioFiscalConfigViewSet(TenantViewSet):
    queryset = ComercioFiscalConfig.objects.all().order_by("-es_principal", "-created_at")
    serializer_class = ComercioFiscalConfigSerializer


class FiscalQueueViewSet(TenantViewSet):
    """Cola de comprobantes fiscales del comercio activo. Solo lectura desde
    acá — se crea/actualiza desde VentaViewSet.facturar (ver ventas/views.py)."""

    queryset = FiscalQueue.objects.all().select_related("venta").order_by("-created_at")
    serializer_class = FiscalQueueSerializer
    filterset_fields = ["status"]
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=False, methods=["post"], url_path="procesar-pendientes")
    def procesar_pendientes(self, request):
        """Reintenta las que quedaron sin CAE.

        Es la contraparte de la facturación automática: si ARCA estaba caído
        cuando se cobró, la venta quedó acá en "pendiente" y desde este botón
        se emiten todas juntas. Se corta en 50 por llamada para no dejar la
        request colgada media hora contra ARCA.
        """
        comercio = resolver_comercio_activo(request)
        config = config_vigente(comercio)
        if config is None:
            return Response(
                {"detail": "Este comercio no tiene configuración fiscal cargada."}, status=400
            )

        pendientes = (
            FiscalQueue.objects.filter(comercio=comercio, status__in=["pendiente", "error"])
            .select_related("venta")
            .prefetch_related("venta__pagos__cuenta_pago")[:50]
        )
        emitidas, fallidas, errores = 0, 0, []
        for item in pendientes:
            venta = item.venta
            if venta is None or venta.anulada or venta.facturado:
                continue
            try:
                emitir_factura(venta, config)
                emitidas += 1
            except ErrorFiscal as exc:
                fallidas += 1
                if len(errores) < 3:
                    errores.append(str(exc))

        return Response({"emitidas": emitidas, "fallidas": fallidas, "errores": errores})
