from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from caja.models import CajaSesion
from core.mixins import TenantViewSet
from core.models import Comercio, UsuarioComercio
from core.permissions import IsDueño
from telemetria.models import ErrorLog
from ventas.models import Venta

from .serializers import ComercioAdminSerializer, ErrorLogSerializer


class ComercioAdminViewSet(viewsets.ModelViewSet):
    """Sucursales (Comercio) que opera el usuario autenticado, con KPIs
    comparativos del día. A propósito NO filtra por el comercio activo (esta
    es la vista para comparar entre sucursales, no para operar una sola)."""

    serializer_class = ComercioAdminSerializer
    permission_classes = [IsAuthenticated, IsDueño]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        comercio_ids = UsuarioComercio.objects.filter(user=self.request.user).values_list("comercio_id", flat=True)
        return Comercio.objects.filter(id__in=comercio_ids).order_by("nombre")

    def list(self, request, *args, **kwargs):
        comercios = list(self.get_queryset())
        # OJO: __date respeta TIME_ZONE (America/Argentina/Buenos_Aires) al
        # resolverse contra la DB, ídem el resto de los KPIs "del día" del
        # sistema (ver estadisticas/views.py::_rango_por_defecto).
        hoy_local = timezone.localtime(timezone.now()).date()

        for comercio in comercios:
            comercio.ventas_hoy = Venta.objects.filter(
                comercio=comercio, created_at__date=hoy_local, anulada=False,
            ).aggregate(total=Sum("total"))["total"] or Decimal("0")
            comercio.caja_abierta = CajaSesion.objects.filter(comercio=comercio, estado="abierta").exists()
            comercio.alertas_count = ErrorLog.objects.filter(comercio=comercio).count()

        serializer = self.get_serializer(comercios, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Alta de una nueva sucursal: el usuario que la crea queda como Dueño."""
        with transaction.atomic():
            comercio = serializer.save()
            UsuarioComercio.objects.create(user=self.request.user, comercio=comercio, rol="Dueño")


class ErrorLogViewSet(TenantViewSet):
    """Errores del front capturados para el comercio activo. Solo lectura."""

    queryset = ErrorLog.objects.all().order_by("-created_at")
    serializer_class = ErrorLogSerializer
    filterset_fields = ["tipo", "modulo"]
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated, IsDueño]
