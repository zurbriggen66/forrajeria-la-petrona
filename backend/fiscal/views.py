from core.mixins import TenantViewSet

from .models import ComercioFiscalConfig, FiscalQueue
from .serializers import ComercioFiscalConfigSerializer, FiscalQueueSerializer


class ComercioFiscalConfigViewSet(TenantViewSet):
    queryset = ComercioFiscalConfig.objects.all().order_by("-es_principal", "-created_at")
    serializer_class = ComercioFiscalConfigSerializer


class FiscalQueueViewSet(TenantViewSet):
    """Cola de comprobantes fiscales del comercio activo. Solo lectura desde
    acá — se crea/actualiza desde VentaViewSet.facturar (ver ventas/views.py)."""

    queryset = FiscalQueue.objects.all().select_related("venta").order_by("-created_at")
    serializer_class = FiscalQueueSerializer
    filterset_fields = ["status"]
    http_method_names = ["get", "head", "options"]
