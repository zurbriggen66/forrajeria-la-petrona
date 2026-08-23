from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from clientes.models import Cliente
from compras.models import Compra, CompraPago
from core.mixins import resolver_comercio_activo
from core.models import Perfil
from finanzas.models import Gasto
from productos.models import Producto
from proveedores.models import Proveedor
from repartos.models import Reparto
from ventas.models import Presupuesto, Venta, VentaItem, VentaPago

from .serializers import (
    ComparativaSerializer,
    InicioSerializer,
    PanelSerializer,
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

# Roles que ven la plata del negocio (deudas, egresos, balance) en el Inicio.
# El Cajero/Repositor ven ventas, caja y pendientes, pero no esto.
ROLES_FINANZAS = ("Dueño", "Administrador")

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


def _variacion_pct(actual, anterior):
    """Variación porcentual contra un período previo. None cuando el anterior
    es cero: no existe "X% más que nada", y devolver 0 o infinito mentiría."""
    if not anterior:
        return None
    return float((actual - anterior) / anterior * 100)


def egresos_en_rango(comercio, fecha_desde=None, fecha_hasta=None):
    """Plata que salió del negocio: gastos + pagos a proveedor.

    Los pagos a proveedor cuentan por CompraPago.fecha (el día que se pagó),
    no por la fecha de la compra: una compra fiada puede entrar el 23/08 y
    pagarse el 15/09, y el egreso es del 15/09.
    """
    gastos = Gasto.objects.filter(comercio=comercio)
    pagos = CompraPago.objects.filter(comercio=comercio)
    if fecha_desde:
        gastos = gastos.filter(fecha__gte=fecha_desde)
        pagos = pagos.filter(fecha__gte=fecha_desde)
    if fecha_hasta:
        gastos = gastos.filter(fecha__lte=fecha_hasta)
        pagos = pagos.filter(fecha__lte=fecha_hasta)
    total_gastos = gastos.aggregate(t=Sum("monto"))["t"] or Decimal("0")
    total_pagos = pagos.aggregate(t=Sum("monto"))["t"] or Decimal("0")
    return total_gastos + total_pagos


def egresos_por_dia(comercio, desde, hasta):
    """Ídem egresos_en_rango pero desglosado por día. Devuelve todos los días
    del rango, con cero en los que no hubo movimiento (los gráficos y el
    dashboard necesitan la serie completa, no sólo los días con datos)."""
    dias = (hasta - desde).days
    por_dia = {desde + timedelta(days=i): Decimal("0") for i in range(dias + 1)}
    for modelo in (Gasto, CompraPago):
        filas = (
            modelo.objects.filter(comercio=comercio, fecha__gte=desde, fecha__lte=hasta)
            .values("fecha").annotate(total=Sum("monto"))
        )
        for f in filas:
            if f["fecha"] in por_dia:
                por_dia[f["fecha"]] += f["total"]
    return por_dia


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

        egresos = egresos_en_rango(
            comercio,
            request.query_params.get("fecha_desde"),
            request.query_params.get("fecha_hasta"),
        )

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
                "variacion_ingresos_pct": _variacion_pct(ingresos_actual, ingresos_anterior),
                "variacion_cantidad_pct": _variacion_pct(Decimal(cantidad_actual), Decimal(cantidad_anterior)),
            },
        }
        return Response(VerdadDelNegocioSerializer(data).data)


def _dia(fila, egresos):
    """Arma el resumen de un día a partir de su fila de la serie semanal.
    `egresos` en None (rol sin acceso) deja también el balance en None, en vez
    de mostrar un balance que sería igual a los ingresos y engañaría."""
    ingresos = fila["ingresos"]
    cantidad = fila["cantidad_ventas"]
    return {
        "ingresos": ingresos,
        "cantidad_ventas": cantidad,
        "ticket_promedio": (ingresos / cantidad) if cantidad else Decimal("0"),
        "egresos": egresos,
        "balance": (ingresos - egresos) if egresos is not None else None,
    }


class InicioView(APIView):
    """Dashboard de Inicio: todo el día a día en una sola llamada — hoy contra
    ayer, la serie de la semana para el gráfico, qué queda pendiente y quién debe.

    Sin filtros a propósito: el alcance es siempre el comercio activo y el día
    de HOY en hora LOCAL. Ojo con esto último: `timezone.now().date()` da la
    fecha UTC, que de noche en Buenos Aires (UTC-3) ya es el día siguiente —
    misma trampa que documenta _rango_por_defecto.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        hoy = timezone.localtime(timezone.now()).date()
        ayer = hoy - timedelta(days=1)
        desde = hoy - timedelta(days=6)

        perfil = Perfil.objects.filter(user=request.user).first()
        ve_finanzas = perfil is not None and perfil.rol in ROLES_FINANZAS

        # --- Serie de 7 días. Trae hoy y ayer de arriba, así que reemplaza a
        # los agregados sueltos de cada uno y garantiza que los tres números
        # salgan de la misma consulta (no pueden discrepar).
        ventas_semana = ventas_filtradas(comercio, {
            "fecha_desde": desde.isoformat(), "fecha_hasta": hoy.isoformat(),
        })
        filas = (
            ventas_semana.annotate(dia=TruncDate("created_at"))
            .values("dia")
            .annotate(ingresos=Sum("total"), cantidad_ventas=Count("id"))
        )
        por_dia = {f["dia"]: f for f in filas}
        # El relleno lo maneja este loop, no las filas de la BD: un día sin
        # ventas tiene que salir en 0, no faltar, o el gráfico miente.
        serie = [
            {
                "fecha": dia,
                "ingresos": por_dia[dia]["ingresos"] if dia in por_dia else Decimal("0"),
                "cantidad_ventas": por_dia[dia]["cantidad_ventas"] if dia in por_dia else 0,
            }
            for dia in (desde + timedelta(days=i) for i in range(7))
        ]

        # Gastos + pagos a proveedor: una compra fiada pesa el día que se paga.
        egresos_dia = egresos_por_dia(comercio, ayer, hoy) if ve_finanzas else {}

        def egresos_de(dia):
            if not ve_finanzas:
                return None
            return egresos_dia.get(dia) or Decimal("0")

        # serie[-1] es hoy y serie[-2] ayer por construcción del loop de arriba.
        dia_hoy = _dia(serie[-1], egresos_de(hoy))
        dia_ayer = _dia(serie[-2], egresos_de(ayer))

        repartos = Reparto.objects.filter(comercio=comercio).aggregate(
            hoy=Count("id", filter=Q(fecha=hoy, estado__in=["pendiente", "en_camino"])),
            pendientes=Count("id", filter=Q(estado="pendiente")),
        )
        presupuestos_pendientes = Presupuesto.objects.filter(
            comercio=comercio, estado="pendiente"
        ).count()
        # Compras fiadas sin saldar. `vencidas` son las que ya pasaron su fecha
        # de vencimiento — las que hay que pagar sí o sí.
        facturas = Compra.objects.filter(comercio=comercio, pagado=False).aggregate(
            por_pagar=Count("id"),
            vencidas=Count("id", filter=Q(fecha_vencimiento__lt=hoy)),
        )
        # `pedidos_sugeridos` replica el predicado exacto de PedidosSugeridosView
        # (proveedores/views.py) — si allá cambia, acá también, o el Inicio y la
        # pantalla de pedidos mostrarían números distintos para lo mismo.
        productos = Producto.objects.filter(comercio=comercio, activo=True).aggregate(
            stock_bajo=Count("id", filter=Q(
                stock__gt=0, stock_minimo__gt=0, stock__lte=F("stock_minimo"))),
            sin_stock=Count("id", filter=Q(stock__lte=0)),
            pedidos_sugeridos=Count("id", filter=Q(
                stock_minimo__gt=0, stock__lte=F("stock_minimo"))),
        )

        deudas = None
        if ve_finanzas:
            # Sin filtrar por activo: un cliente dado de baja que debe plata
            # sigue debiendo plata.
            por_cobrar = Cliente.objects.filter(comercio=comercio, saldo_actual__gt=0)
            deudas = {
                "total_por_cobrar": por_cobrar.aggregate(t=Sum("saldo_actual"))["t"] or Decimal("0"),
                "top_deudores": list(
                    por_cobrar.order_by("-saldo_actual").values("id", "nombre", "saldo_actual")[:5]
                ),
                "total_por_pagar": Proveedor.objects.filter(
                    comercio=comercio, saldo_actual__gt=0
                ).aggregate(t=Sum("saldo_actual"))["t"] or Decimal("0"),
            }

        ventas_hoy = ventas_filtradas(comercio, {
            "fecha_desde": hoy.isoformat(), "fecha_hasta": hoy.isoformat(),
        })
        top_hoy = (
            VentaItem.objects.filter(venta__in=ventas_hoy, producto__isnull=False)
            .values("producto_id", "producto__nombre")
            .annotate(cantidad=Sum("cantidad"), ingresos=Sum("subtotal"))
            .order_by("-ingresos")[:5]
        )

        ingresos_semana = sum((d["ingresos"] for d in serie), Decimal("0"))
        data = {
            "fecha": hoy,
            "hoy": dia_hoy,
            "ayer": dia_ayer,
            "comparacion": {
                "variacion_ingresos_pct": _variacion_pct(
                    dia_hoy["ingresos"], dia_ayer["ingresos"]),
                "variacion_cantidad_pct": _variacion_pct(
                    Decimal(dia_hoy["cantidad_ventas"]), Decimal(dia_ayer["cantidad_ventas"])),
                # Sobre la ventana fija de 7 días, no sobre "los días que
                # vendieron": un domingo muerto tiene que bajar el promedio.
                "promedio_diario_7d": ingresos_semana / 7,
            },
            "serie_7dias": serie,
            "pendientes": {
                "repartos_hoy": repartos["hoy"],
                "repartos_pendientes": repartos["pendientes"],
                "presupuestos_pendientes": presupuestos_pendientes,
                "stock_bajo": productos["stock_bajo"],
                "sin_stock": productos["sin_stock"],
                "pedidos_sugeridos": productos["pedidos_sugeridos"],
                "facturas_por_pagar": facturas["por_pagar"],
                "facturas_vencidas": facturas["vencidas"],
            },
            "deudas": deudas,
            "top_productos_hoy": [
                {
                    "producto": f["producto_id"],
                    "nombre": f["producto__nombre"],
                    "cantidad": f["cantidad"],
                    "ingresos": f["ingresos"],
                }
                for f in top_hoy
            ],
        }
        return Response(InicioSerializer(data).data)


class PanelView(APIView):
    """Dashboard de Estadísticas: los KPIs del período con su variación contra
    el período anterior, la curva de ingresos vs egresos, en qué se cobra, qué
    clientes facturan más, a qué hora se vende y la actividad reciente.

    Todo en una llamada y con los mismos filtros que el resto del módulo
    (ventas_filtradas), para que el panel no pueda contradecir a las otras
    pestañas.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        desde, hasta = _rango_por_defecto(request.query_params)
        filtros = {**request.query_params.dict(),
                   "fecha_desde": desde.isoformat(), "fecha_hasta": hasta.isoformat()}
        ventas = ventas_filtradas(comercio, filtros)

        agg = ventas.aggregate(ingresos=Sum("total"), cantidad=Count("id"))
        ingresos = agg["ingresos"] or Decimal("0")
        cantidad = agg["cantidad"] or 0

        items = items_con_costo(VentaItem.objects.filter(venta__in=ventas))
        item_agg = items.aggregate(subtotal=Sum("subtotal"), costo=Sum("item_costo"))
        margen_pct = _margen_pct(item_agg["subtotal"] or Decimal("0"), item_agg["costo"] or Decimal("0"))

        egresos = egresos_en_rango(comercio, desde, hasta)

        # Período anterior del mismo largo, para las variaciones.
        dias = (hasta - desde).days + 1
        hasta_prev = desde - timedelta(days=1)
        desde_prev = hasta_prev - timedelta(days=dias - 1)
        ventas_prev = ventas_filtradas(comercio, {
            **request.query_params.dict(),
            "fecha_desde": desde_prev.isoformat(), "fecha_hasta": hasta_prev.isoformat(),
        })
        agg_prev = ventas_prev.aggregate(ingresos=Sum("total"), cantidad=Count("id"))
        ingresos_prev = agg_prev["ingresos"] or Decimal("0")
        cantidad_prev = agg_prev["cantidad"] or 0
        egresos_prev = egresos_en_rango(comercio, desde_prev, hasta_prev)

        # --- Serie diaria de ingresos vs egresos (el gráfico principal), más
        # cantidad de ventas y ticket promedio por día (gráfico de abajo).
        ventas_por_dia = {
            f["dia"]: f
            for f in ventas.annotate(dia=TruncDate("created_at")).values("dia")
            .annotate(total=Sum("total"), cantidad=Count("id"))
        }
        egresos_dia = egresos_por_dia(comercio, desde, hasta)
        serie = []
        for dia in (desde + timedelta(days=i) for i in range((hasta - desde).days + 1)):
            fila = ventas_por_dia.get(dia)
            ingresos_dia = fila["total"] if fila else Decimal("0")
            cantidad_dia = fila["cantidad"] if fila else 0
            serie.append({
                "fecha": dia,
                "ingresos": ingresos_dia,
                "egresos": egresos_dia.get(dia) or Decimal("0"),
                "cantidad_ventas": cantidad_dia,
                "ticket_promedio": (ingresos_dia / cantidad_dia) if cantidad_dia else Decimal("0"),
            })

        # --- En qué se cobra. Sale de VentaPago (el desglose real del cobro),
        # más lo que se fió, que no entra por ninguna cuenta.
        metodos = [
            {"metodo": p["cuenta_pago__nombre"] or "Efectivo", "monto": p["monto"]}
            for p in VentaPago.objects.filter(venta__in=ventas)
            .values("cuenta_pago__nombre").annotate(monto=Sum("monto")).order_by("-monto")
        ]
        fiado = ventas.aggregate(t=Sum("monto_cuenta_corriente"))["t"] or Decimal("0")
        if fiado > 0:
            metodos.append({"metodo": "Cuenta corriente", "monto": fiado})
        total_metodos = sum((m["monto"] for m in metodos), Decimal("0"))
        for m in metodos:
            m["pct"] = float(m["monto"] / total_metodos * 100) if total_metodos else 0.0
        metodos.sort(key=lambda m: m["monto"], reverse=True)

        top_clientes = [
            {
                "cliente": c["cliente_id"],
                "nombre": c["cliente__nombre"],
                "ingresos": c["ingresos"],
                "cantidad_ventas": c["cantidad_ventas"],
            }
            for c in ventas.filter(cliente__isnull=False)
            .values("cliente_id", "cliente__nombre")
            .annotate(ingresos=Sum("total"), cantidad_ventas=Count("id"))
            .order_by("-ingresos")[:5]
        ]

        por_hora = [
            {"hora": f["hora"], "ingresos": f["ingresos"], "cantidad_ventas": f["cantidad_ventas"]}
            for f in ventas.annotate(hora=ExtractHour("created_at")).values("hora")
            .annotate(ingresos=Sum("total"), cantidad_ventas=Count("id")).order_by("hora")
        ]

        # --- Capital dormido: mercadería con stock que no se vendió ni una vez
        # en el período. Con miles de productos en catálogo es la plata que está
        # quieta en el depósito, que es lo que de verdad duele.
        vendidos = VentaItem.objects.filter(venta__in=ventas, producto__isnull=False).values("producto_id")
        sin_rotacion = Producto.objects.filter(
            comercio=comercio, activo=True, stock__gt=0
        ).exclude(id__in=vendidos)
        inmovilizado = sin_rotacion.aggregate(
            capital=Sum(ExpressionWrapper(
                F("stock") * F("precio_costo"),
                output_field=DecimalField(max_digits=18, decimal_places=2),
            )),
            productos=Count("id"),
        )

        data = {
            "periodo": {"desde": desde, "hasta": hasta},
            "kpis": {
                "ingresos": ingresos,
                "egresos": egresos,
                "balance": ingresos - egresos,
                "margen_pct": margen_pct,
                "ticket_promedio": (ingresos / cantidad) if cantidad else Decimal("0"),
                "cantidad_ventas": cantidad,
                "capital_inmovilizado": inmovilizado["capital"] or Decimal("0"),
                "productos_sin_rotacion": inmovilizado["productos"],
                "var_ingresos_pct": _variacion_pct(ingresos, ingresos_prev),
                "var_egresos_pct": _variacion_pct(egresos, egresos_prev),
                "var_balance_pct": _variacion_pct(ingresos - egresos, ingresos_prev - egresos_prev),
                "var_cantidad_pct": _variacion_pct(Decimal(cantidad), Decimal(cantidad_prev)),
            },
            "serie": serie,
            "metodos_pago": metodos,
            "top_clientes": top_clientes,
            "por_hora": por_hora,
            "actividad": self._actividad_reciente(comercio, ventas),
        }
        return Response(PanelSerializer(data).data)

    @staticmethod
    def _actividad_reciente(comercio, ventas):
        """Últimos movimientos de plata, mezclando ventas, gastos y pagos a
        proveedor en una sola línea de tiempo."""
        eventos = []
        for v in ventas.select_related("cliente").order_by("-created_at")[:8]:
            eventos.append({
                "tipo": "venta",
                "descripcion": f"Venta #{v.numero_ticket}" if v.numero_ticket else "Venta",
                "detalle": v.cliente.nombre if v.cliente_id else "Consumidor final",
                "fecha": timezone.localtime(v.created_at).date(),
                "monto": v.total,
                "signo": 1,
            })
        for g in Gasto.objects.filter(comercio=comercio).order_by("-fecha", "-created_at")[:5]:
            eventos.append({
                "tipo": "gasto",
                "descripcion": g.descripcion or g.categoria or "Gasto",
                "detalle": g.categoria or "",
                "fecha": g.fecha,
                "monto": g.monto,
                "signo": -1,
            })
        for p in (
            CompraPago.objects.filter(comercio=comercio)
            .select_related("compra__proveedor").order_by("-fecha", "-created_at")[:5]
        ):
            proveedor = p.compra.proveedor.nombre if p.compra.proveedor_id else "Proveedor"
            eventos.append({
                "tipo": "pago_proveedor",
                "descripcion": f"Pago a {proveedor}",
                "detalle": p.compra.numero_factura or "sin factura",
                "fecha": p.fecha,
                "monto": p.monto,
                "signo": -1,
            })
        eventos.sort(key=lambda e: e["fecha"], reverse=True)
        return eventos[:8]
