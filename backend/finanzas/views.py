from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from caja.models import CajaMovimiento, CajaSesion, CuentaPago
from caja.views import resolver_cuenta_efectivo
from core.mixins import TenantViewSet, resolver_comercio_activo

from .models import Gasto
from .serializers import GastoSerializer


class GastoViewSet(TenantViewSet):
    """Gastos y pagos a proveedor. Si hay una caja abierta al momento de
    registrarlo, el gasto queda atado a esa sesión y genera un CajaMovimiento
    de egreso (en la cuenta elegida, o Efectivo por defecto) para que se
    descuente del arqueo y del contenedor correspondiente al cerrar."""

    # select_related: el serializer expone `cuenta_nombre`, y sin esto cada
    # gasto de la página dispara su propia consulta — 100 gastos salían 104
    # consultas en vez de 4.
    queryset = Gasto.objects.select_related("cuenta").order_by("-fecha", "-created_at")
    serializer_class = GastoSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["categoria", "caja_sesion", "tipo"]
    search_fields = ["descripcion", "categoria"]

    def get_queryset(self):
        """Rango de fechas por query param, igual que Ventas y Compras: con
        cientos de gastos, poder acotar a un mes es lo que hace usable la
        pantalla."""
        qs = super().get_queryset()
        fecha_desde = self.request.query_params.get("fecha_desde")
        fecha_hasta = self.request.query_params.get("fecha_hasta")
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)
        return qs

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        """Totales por categoría de TODOS los gastos que matchean el filtro.

        Va aparte del listado a propósito: las tarjetas de arriba tienen que
        sumar todo el período, no la página que se está viendo. Calcularlas en
        el navegador sobre las filas traídas daba un total distinto en cada
        página.
        """
        qs = self.filter_queryset(self.get_queryset())
        por_categoria = {
            f["categoria"]: f["total"]
            for f in qs.values("categoria").annotate(total=Sum("monto"))
        }
        return Response({
            "total": qs.aggregate(t=Sum("monto"))["t"] or Decimal("0"),
            "por_categoria": [
                {"categoria": cat or "Sin categoría", "monto": monto}
                for cat, monto in sorted(por_categoria.items(), key=lambda kv: -kv[1])
            ],
        })

    def perform_create(self, serializer):
        comercio = resolver_comercio_activo(self.request)
        caja_sesion = CajaSesion.objects.filter(comercio=comercio, estado="abierta").first()

        cuenta_id = serializer.validated_data.pop("cuenta_id", None)
        cuenta = None
        if cuenta_id is not None:
            cuenta = CuentaPago.objects.filter(comercio=comercio, id=cuenta_id).first()
            if cuenta is None:
                raise ValidationError({"cuenta_id": "No pertenece a este comercio."})
        elif caja_sesion is not None:
            cuenta = resolver_cuenta_efectivo(comercio)

        with transaction.atomic():
            gasto = serializer.save(comercio=comercio, caja_sesion=caja_sesion, cuenta=cuenta)
            if caja_sesion is not None:
                CajaMovimiento.objects.create(
                    comercio=comercio,
                    sesion=caja_sesion,
                    cuenta=cuenta,
                    tipo="egreso",
                    concepto=gasto.descripcion or gasto.categoria or "Gasto",
                    monto=gasto.monto,
                )
