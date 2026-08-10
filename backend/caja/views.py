from core.mixins import TenantViewSet

from .models import CuentaPago
from .serializers import CuentaPagoSerializer


class CuentaPagoViewSet(TenantViewSet):
    """Medios de cobro (efectivo, tarjeta, MP, transferencia). CRUD completo de
    caja (sesiones, movimientos, arqueo) llega en la Fase 3."""

    queryset = CuentaPago.objects.all().order_by("nombre")
    serializer_class = CuentaPagoSerializer
    filterset_fields = ["activo"]
