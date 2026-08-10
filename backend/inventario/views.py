from django.db.models import Case, DecimalField, ExpressionWrapper, F, Sum, When
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import resolver_comercio_activo
from productos.models import Producto

from .serializers import InventarioResumenSerializer, RankingRentabilidadItemSerializer


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
