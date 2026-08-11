from django.db import transaction
from django.db.models import Case, DecimalField, ExpressionWrapper, F, Sum, When
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import TenantViewSet, resolver_comercio_activo
from productos.models import Producto

from .models import Deposito, StockDeposito
from .serializers import (
    DepositoSerializer,
    InventarioResumenSerializer,
    RankingRentabilidadItemSerializer,
    StockDepositoSerializer,
    TransferenciaStockSerializer,
)


class DepositoViewSet(TenantViewSet):
    """Depósitos/contenedores de stock aparte del local (Fase 5)."""

    queryset = Deposito.objects.all().order_by("nombre")
    serializer_class = DepositoSerializer
    filterset_fields = ["activo"]


class StockDepositoViewSet(TenantViewSet):
    """Stock por depósito, sólo lectura: se mueve con la acción `transferir`,
    nunca se edita directamente (evita que se desincronice del origen)."""

    queryset = StockDeposito.objects.select_related("deposito", "producto").all().order_by("deposito__nombre", "producto__nombre")
    serializer_class = StockDepositoSerializer
    filterset_fields = ["deposito", "producto"]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "transferir":
            return TransferenciaStockSerializer
        return StockDepositoSerializer

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST", detail="Usá /inventario/stock-deposito/transferir/ para mover stock.")

    def _resolver_ubicacion(self, comercio, producto, ubicacion):
        """Devuelve un objeto con .stock legible/escribible: el Producto
        mismo si ubicacion == "central", o su fila en un depósito puntual."""
        if ubicacion == "central":
            return producto
        deposito = Deposito.objects.filter(comercio=comercio, id=ubicacion).first()
        if deposito is None:
            raise ValidationError(f'Depósito "{ubicacion}" no existe en este comercio.')
        fila, _ = StockDeposito.objects.select_for_update().get_or_create(
            comercio=comercio, deposito=deposito, producto=producto, defaults={"stock": 0},
        )
        return fila

    @action(detail=False, methods=["post"])
    def transferir(self, request):
        comercio = resolver_comercio_activo(request)
        serializer = TransferenciaStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            producto = Producto.objects.select_for_update().filter(comercio=comercio, id=data["producto"]).first()
            if producto is None:
                raise ValidationError({"producto": "No pertenece a este comercio."})

            origen = self._resolver_ubicacion(comercio, producto, data["origen"])
            destino = self._resolver_ubicacion(comercio, producto, data["destino"])

            if origen.stock < data["cantidad"]:
                raise ValidationError(f'No hay stock suficiente en el origen (disponible: {origen.stock}).')

            origen.stock -= data["cantidad"]
            destino.stock += data["cantidad"]
            origen.save(update_fields=["stock"])
            if destino is not origen:
                destino.save(update_fields=["stock"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class InventarioResumenView(APIView):
    """KPIs de la Fase 1: valor de stock, productos con stock bajo / sin stock."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        productos = Producto.objects.filter(comercio=comercio, activo=True)

        agregados = productos.aggregate(
            valor_costo=Sum(ExpressionWrapper(F("stock") * F("precio_costo"), output_field=DecimalField(max_digits=16, decimal_places=2))),
            valor_venta=Sum(ExpressionWrapper(F("stock") * F("precio_venta"), output_field=DecimalField(max_digits=16, decimal_places=2))),
        )

        data = {
            "total_productos": productos.count(),
            "valor_stock_costo": agregados["valor_costo"] or 0,
            "valor_stock_venta": agregados["valor_venta"] or 0,
            "stock_bajo_count": productos.filter(stock__gt=0, stock__lte=F("stock_minimo")).count(),
            "sin_stock_count": productos.filter(stock__lte=0).count(),
        }
        return Response(InventarioResumenSerializer(data).data)


class RankingRentabilidadView(APIView):
    """Ranking por margen (precio_venta vs precio_costo).

    Nota: hasta que exista el módulo de Ventas (Fase 2), el ranking se basa en
    margen potencial por producto, no en rentabilidad real de ventas.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        productos = (
            Producto.objects.filter(comercio=comercio, activo=True, precio_venta__gt=0)
            .annotate(
                margen=ExpressionWrapper(
                    (F("precio_venta") - F("precio_costo")) * 100.0 / F("precio_venta"),
                    output_field=DecimalField(max_digits=8, decimal_places=2),
                )
            )
            .order_by("-margen")[:20]
        )
        data = [
            {
                "id": p.id,
                "nombre": p.nombre,
                "categoria": p.categoria,
                "precio_costo": p.precio_costo,
                "precio_venta": p.precio_venta,
                "margen_pct": float(p.margen),
                "stock": p.stock,
            }
            for p in productos
        ]
        return Response(RankingRentabilidadItemSerializer(data, many=True).data)
