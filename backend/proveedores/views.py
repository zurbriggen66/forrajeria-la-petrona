from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from core.permissions import ModuloHabilitado

from core.mixins import TenantViewSet, resolver_comercio_activo
from productos.models import Producto

from .models import FacturaProveedor, PedidoCatalogo, PedidoManual, Proveedor, ProveedorMovimiento
from .serializers import (
    FacturaProveedorSerializer,
    PedidoCatalogoSerializer,
    PedidoManualSerializer,
    PedidoSugeridoItemSerializer,
    ProveedorMovimientoCreateSerializer,
    ProveedorMovimientoSerializer,
    ProveedorSerializer,
)


def aplicar_movimiento_proveedor(proveedor, tipo, monto):
    """Actualiza el saldo de cuenta corriente del proveedor. `monto` es el
    valor absoluto del movimiento; el signo del efecto lo decide `tipo`:
    compra/ajuste suman deuda, pago la resta. Para un ajuste "a favor" (que
    reduzca saldo) mandá un `monto` negativo."""
    signo = -1 if tipo == "pago" else 1
    Proveedor.objects.filter(pk=proveedor.pk).update(saldo_actual=F("saldo_actual") + signo * monto)
    proveedor.refresh_from_db(fields=["saldo_actual"])


class ProveedorViewSet(TenantViewSet):
    """Proveedores con cuenta corriente (Fase 5)."""

    queryset = Proveedor.objects.all().order_by("nombre")
    serializer_class = ProveedorSerializer
    filterset_fields = ["activo"]
    search_fields = ["nombre", "cuit"]

    @action(detail=True, methods=["get"])
    def movimientos(self, request, pk=None):
        proveedor = self.get_object()
        movimientos = ProveedorMovimiento.objects.filter(proveedor=proveedor).order_by("-created_at")
        return Response(ProveedorMovimientoSerializer(movimientos, many=True).data)

    @action(detail=True, methods=["post"], url_path="movimientos/nuevo")
    def nuevo_movimiento(self, request, pk=None):
        proveedor = self.get_object()
        serializer = ProveedorMovimientoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            movimiento = ProveedorMovimiento.objects.create(
                comercio=proveedor.comercio,
                proveedor=proveedor,
                tipo=data["tipo"],
                monto=data["monto"],
                referencia=data["referencia"],
            )
            aplicar_movimiento_proveedor(proveedor, data["tipo"], data["monto"])

        return Response(ProveedorMovimientoSerializer(movimiento).data, status=status.HTTP_201_CREATED)


class FacturaProveedorViewSet(TenantViewSet):
    """Carga manual de facturas de proveedor (el parseo automático queda
    fuera de esta fase)."""

    queryset = FacturaProveedor.objects.all().order_by("-fecha", "-created_at")
    serializer_class = FacturaProveedorSerializer
    filterset_fields = ["proveedor"]


class PedidoManualViewSet(TenantViewSet):
    queryset = PedidoManual.objects.all().order_by("-created_at")
    serializer_class = PedidoManualSerializer
    filterset_fields = ["estado"]


class PedidoCatalogoViewSet(TenantViewSet):
    queryset = PedidoCatalogo.objects.all().order_by("-created_at")
    serializer_class = PedidoCatalogoSerializer
    filterset_fields = ["estado", "proveedor"]


class PedidosSugeridosView(APIView):
    """Productos por debajo de su stock mínimo, agrupados por proveedor, con
    la cantidad sugerida para volver a ese mínimo."""

    permission_classes = [IsAuthenticated, ModuloHabilitado]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        productos = (
            Producto.objects.filter(comercio=comercio, activo=True, stock_minimo__gt=0)
            .filter(stock__lte=F("stock_minimo"))
            .select_related("proveedor")
            .order_by("proveedor__nombre", "nombre")
        )
        data = [
            {
                "producto": p.id,
                "nombre": p.nombre,
                "proveedor": p.proveedor_id,
                "proveedor_nombre": p.proveedor.nombre if p.proveedor else None,
                "stock": p.stock,
                "stock_minimo": p.stock_minimo,
                "cantidad_sugerida": max(p.stock_minimo - p.stock, Decimal("0")),
            }
            for p in productos
        ]
        return Response(PedidoSugeridoItemSerializer(data, many=True).data)
