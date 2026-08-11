from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import ExtractHour
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import resolver_comercio_activo
from finanzas.models import Gasto
from ventas.models import Venta, VentaItem

from .serializers import (
    ComparativaSerializer,
    RankingsSerializer,
    RentabilidadCategoriaSerializer,
    RentabilidadHoraSerializer,
    RentabilidadProductoSerializer,
    RentabilidadProveedorSerializer,
    ResumenSerializer,
    TopProductoSerializer,
    TopVendedorSerializer,
    VerdadDelNegocioSerializer,
)

COSTO_ITEM = ExpressionWrapper(
    F("costo_unitario") * F("cantidad"), output_field=DecimalField(max_digits=16, decimal_places=2)
)


def items_con_costo(qs):
    """Agrega `item_costo` como columna por fila (no agregada) ANTES de
    cualquier .values().annotate(Sum(...)): si `costo=Sum(COSTO_ITEM)` se
    calcula en el mismo .annotate() que también agrega `cantidad=Sum("cantidad")`,
    Django resuelve F("cantidad") contra ese alias agregado y explota con
    "Cannot compute Sum(): ... is an aggregate" (agregado anidado)."""
    return qs.annotate(item_costo=COSTO_ITEM)


def _margen_pct(ingresos, costo):
    if not ingresos:
        return 0.0
    return float((ingresos - costo) / ingresos * 100)


def ventas_filtradas(comercio, params):
    """Ventas no anuladas del comercio, según los filtros del panel de
    Estadísticas: fechas, vendedor, cuenta de pago, categoría y proveedor.
    Categoría/proveedor filtran por "la venta incluyó un ítem de…", así que
    ingresos/cantidad siguen cuadrando exactamente con `Venta.total` — el
    desglose ítem por ítem (rentabilidad real) va aparte, en VentaItem.

    Ojo: categoría/proveedor se resuelven con un subquery `id__in=` (no un
    join directo) a propósito — un join por `items__` duplicaría la fila de
    Venta por cada ítem que matchee, e inflaría cualquier Sum/Count posterior
    salvo que se agregue `.distinct()` con mucho cuidado en cada uso. El
    subquery evita esa clase de bug de entrada.
    """
    qs = Venta.objects.filter(comercio=comercio, anulada=False)
    fecha_desde = params.get("fecha_desde")
    fecha_hasta = params.get("fecha_hasta")
    if fecha_desde:
        qs = qs.filter(created_at__date__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(created_at__date__lte=fecha_hasta)
    if params.get("vendedor"):
        qs = qs.filter(vendedor_id=params["vendedor"])
    if params.get("cuenta_pago"):
        qs = qs.filter(cuenta_pago_id=params["cuenta_pago"])
    if params.get("categoria"):
        qs = qs.filter(id__in=VentaItem.objects.filter(
            producto__categoria=params["categoria"]
        ).values("venta_id"))
    if params.get("proveedor"):
        qs = qs.filter(id__in=VentaItem.objects.filter(
            producto__proveedor_id=params["proveedor"]
        ).values("venta_id"))
    return qs


class ResumenView(APIView):
    """KPIs del panel de Estadísticas (Fase 4): ingresos, egresos, balance,
    margen, ticket promedio y cantidad — sobre ventas reales, con filtros."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        ventas = ventas_filtradas(comercio, request.query_params)

        agregados = ventas.aggregate(ingresos=Sum("total"), cantidad=Count("id"))
        ingresos = agregados["ingresos"] or Decimal("0")
        cantidad = agregados["cantidad"] or 0

        items = items_con_costo(VentaItem.objects.filter(venta__in=ventas))
        item_agg = items.aggregate(subtotal=Sum("subtotal"), costo=Sum("item_costo"))
        margen_pct = _margen_pct(item_agg["subtotal"] or Decimal("0"), item_agg["costo"] or Decimal("0"))

        gastos = Gasto.objects.filter(comercio=comercio)
        if request.query_params.get("fecha_desde"):
            gastos = gastos.filter(fecha__gte=request.query_params["fecha_desde"])
        if request.query_params.get("fecha_hasta"):
            gastos = gastos.filter(fecha__lte=request.query_params["fecha_hasta"])
        egresos = gastos.aggregate(total=Sum("monto"))["total"] or Decimal("0")

        data = {
            "ingresos": ingresos,
            "egresos": egresos,
            "balance": ingresos - egresos,
            "margen_pct": margen_pct,
            "ticket_promedio": (ingresos / cantidad) if cantidad else Decimal("0"),
            "cantidad_ventas": cantidad,
        }
        return Response(ResumenSerializer(data).data)


class RankingsView(APIView):
    """Top productos y top vendedores del período filtrado, por ventas reales."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        ventas = ventas_filtradas(comercio, request.query_params)

        top_productos = (
            VentaItem.objects.filter(venta__in=ventas, producto__isnull=False)
            .values("producto_id", "producto__nombre")
            .annotate(cantidad=Sum("cantidad"), ingresos=Sum("subtotal"))
            .order_by("-ingresos")[:10]
        )
        top_vendedores = (
            ventas.values("vendedor_id", "vendedor__nombre_completo")
            .annotate(cantidad_ventas=Count("id"), ingresos=Sum("total"))
            .order_by("-ingresos")[:10]
        )

        data = {
            "top_productos": TopProductoSerializer(
                [
                    {"producto": p["producto_id"], "nombre": p["producto__nombre"], "cantidad": p["cantidad"], "ingresos": p["ingresos"]}
                    for p in top_productos
                ],
                many=True,
            ).data,
            "top_vendedores": TopVendedorSerializer(
                [
                    {
                        "vendedor": v["vendedor_id"],
                        "nombre": v["vendedor__nombre_completo"] or "Sin vendedor",
                        "cantidad_ventas": v["cantidad_ventas"],
                        "ingresos": v["ingresos"],
                    }
                    for v in top_vendedores
                ],
                many=True,
            ).data,
        }
        return Response(RankingsSerializer(data).data)


class RentabilidadView(APIView):
    """Margen real (precio vs costo de venta) por producto, a partir de
    ventas efectivamente registradas — no de la lista de precios (eso ya
    lo cubre Inventario > Ranking rentabilidad desde la Fase 1)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        ventas = ventas_filtradas(comercio, request.query_params)

        filas = (
            items_con_costo(VentaItem.objects.filter(venta__in=ventas, producto__isnull=False))
            .values("producto_id", "producto__nombre", "producto__categoria")
            .annotate(cantidad=Sum("cantidad"), ingresos=Sum("subtotal"), costo=Sum("item_costo"))
            .order_by("-ingresos")[:30]
        )
        data = [
            {
                "producto": f["producto_id"],
                "nombre": f["producto__nombre"],
                "categoria": f["producto__categoria"] or "Sin categoría",
                "cantidad": f["cantidad"],
                "ingresos": f["ingresos"],
                "costo": f["costo"] or Decimal("0"),
                "margen_pct": _margen_pct(f["ingresos"], f["costo"] or Decimal("0")),
            }
            for f in filas
        ]
        return Response(RentabilidadProductoSerializer(data, many=True).data)


def _rango_por_defecto(params):
    # OJO: timezone.now().date() extrae la fecha en UTC, no la fecha local del
    # comercio (TIME_ZONE = America/Argentina/Buenos_Aires) — de noche esas dos
    # fechas difieren (ya es "mañana" en UTC). localtime() hace la conversión.
    hoy_local = timezone.localtime(timezone.now()).date()
    fecha_hasta = parse_date(params.get("fecha_hasta") or "") or hoy_local
    fecha_desde = parse_date(params.get("fecha_desde") or "") or (fecha_hasta - timedelta(days=29))
    return fecha_desde, fecha_hasta


class VerdadDelNegocioView(APIView):
    """Rentabilidad real por categoría/proveedor/hora + comparativa contra el
    período inmediatamente anterior (mismo largo de rango, hacia atrás)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        fecha_desde, fecha_hasta = _rango_por_defecto(request.query_params)

        ventas = ventas_filtradas(comercio, {
            **request.query_params.dict(),
            "fecha_desde": fecha_desde.isoformat(),
            "fecha_hasta": fecha_hasta.isoformat(),
        })
        items = items_con_costo(VentaItem.objects.filter(venta__in=ventas, producto__isnull=False))

        por_categoria_raw = (
            items.values("producto__categoria")
            .annotate(ingresos=Sum("subtotal"), costo=Sum("item_costo"))
            .order_by("-ingresos")
        )
        por_categoria = [
            {
                "categoria": f["producto__categoria"] or "Sin categoría",
                "ingresos": f["ingresos"],
                "costo": f["costo"] or Decimal("0"),
                "margen_pct": _margen_pct(f["ingresos"], f["costo"] or Decimal("0")),
            }
            for f in por_categoria_raw
        ]

        por_proveedor_raw = (
            items.values("producto__proveedor_id", "producto__proveedor__nombre")
            .annotate(ingresos=Sum("subtotal"), costo=Sum("item_costo"))
            .order_by("-ingresos")
        )
        por_proveedor = [
            {
                "proveedor": f["producto__proveedor_id"],
                "nombre": f["producto__proveedor__nombre"] or "Sin proveedor",
                "ingresos": f["ingresos"],
                "costo": f["costo"] or Decimal("0"),
                "margen_pct": _margen_pct(f["ingresos"], f["costo"] or Decimal("0")),
            }
            for f in por_proveedor_raw
        ]

        por_hora_raw = (
            ventas.annotate(hora=ExtractHour("created_at"))
            .values("hora")
            .annotate(ingresos=Sum("total"), cantidad_ventas=Count("id"))
            .order_by("hora")
        )
        por_hora = [
            {"hora": f["hora"], "ingresos": f["ingresos"], "cantidad_ventas": f["cantidad_ventas"]}
            for f in por_hora_raw
        ]

        dias = (fecha_hasta - fecha_desde).days + 1
        fecha_hasta_anterior = fecha_desde - timedelta(days=1)
        fecha_desde_anterior = fecha_hasta_anterior - timedelta(days=dias - 1)
        ventas_anteriores = ventas_filtradas(comercio, {
            "fecha_desde": fecha_desde_anterior.isoformat(),
            "fecha_hasta": fecha_hasta_anterior.isoformat(),
        })
        agg_actual = ventas.aggregate(ingresos=Sum("total"), cantidad=Count("id"))
        agg_anterior = ventas_anteriores.aggregate(ingresos=Sum("total"), cantidad=Count("id"))
        ingresos_actual = agg_actual["ingresos"] or Decimal("0")
        ingresos_anterior = agg_anterior["ingresos"] or Decimal("0")
        cantidad_actual = agg_actual["cantidad"] or 0
        cantidad_anterior = agg_anterior["cantidad"] or 0

        def variacion(actual, anterior):
            if not anterior:
                return None
            return float((actual - anterior) / anterior * 100)

        data = {
            "por_categoria": por_categoria,
            "por_proveedor": por_proveedor,
            "por_hora": por_hora,
            "comparativa": {
                "periodo_actual": {
                    "desde": fecha_desde, "hasta": fecha_hasta,
                    "ingresos": ingresos_actual, "cantidad_ventas": cantidad_actual,
                },
                "periodo_anterior": {
                    "desde": fecha_desde_anterior, "hasta": fecha_hasta_anterior,
                    "ingresos": ingresos_anterior, "cantidad_ventas": cantidad_anterior,
                },
                "variacion_ingresos_pct": variacion(ingresos_actual, ingresos_anterior),
                "variacion_cantidad_pct": variacion(Decimal(cantidad_actual), Decimal(cantidad_anterior)),
            },
        }
        return Response(VerdadDelNegocioSerializer(data).data)
