from django.db import transaction
from django.db.models import F
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSet

from .models import Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead
from .serializers import (
    ClienteAsignacionSerializer,
    ClienteMovimientoCreateSerializer,
    ClienteMovimientoSerializer,
    ClienteSerializer,
    CrmLeadSerializer,
)


def aplicar_movimiento_cliente(cliente, tipo, monto):
    """Actualiza el saldo de cuenta corriente del cliente (lo que le debe al
    comercio). `monto` es el valor absoluto del movimiento; el signo del
    efecto lo decide `tipo`: cargo/ajuste suman deuda, pago la resta."""
    signo = -1 if tipo == "pago" else 1
    Cliente.objects.filter(pk=cliente.pk).update(saldo_actual=F("saldo_actual") + signo * monto)
    cliente.refresh_from_db(fields=["saldo_actual"])


class ClienteViewSet(TenantViewSet):
    """Clientes con cuenta corriente, límite de crédito y asignación a
    vendedor (Fase 6)."""

    queryset = Cliente.objects.all().order_by("nombre")
    serializer_class = ClienteSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["activo", "tipo"]
    search_fields = ["nombre", "telefono", "celular", "cuit"]

    @action(detail=True, methods=["get"])
    def movimientos(self, request, pk=None):
        cliente = self.get_object()
        movimientos = ClienteMovimiento.objects.filter(cliente=cliente).order_by("-created_at")
        return Response(ClienteMovimientoSerializer(movimientos, many=True).data)

    @action(detail=True, methods=["post"], url_path="movimientos/nuevo")
    def nuevo_movimiento(self, request, pk=None):
        cliente = self.get_object()
        serializer = ClienteMovimientoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            movimiento = ClienteMovimiento.objects.create(
                comercio=cliente.comercio,
                cliente=cliente,
                tipo=data["tipo"],
                monto=data["monto"],
                referencia=data["referencia"],
            )
            aplicar_movimiento_cliente(cliente, data["tipo"], data["monto"])

        return Response(ClienteMovimientoSerializer(movimiento).data, status=status.HTTP_201_CREATED)


class ClienteAsignacionViewSet(TenantViewSet):
    queryset = ClienteAsignacion.objects.all().order_by("-created_at")
    serializer_class = ClienteAsignacionSerializer
    filterset_fields = ["cliente", "vendedor", "activo"]


class CrmLeadViewSet(TenantViewSet):
    queryset = CrmLead.objects.all().order_by("-created_at")
    serializer_class = CrmLeadSerializer
    filterset_fields = ["estado"]
