from django.db import transaction
from rest_framework.exceptions import ValidationError

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

    queryset = Gasto.objects.all().order_by("-fecha", "-created_at")
    serializer_class = GastoSerializer
    filterset_fields = ["categoria", "caja_sesion"]

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
