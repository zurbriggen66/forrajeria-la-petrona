"""Gestión contable: los números del negocio con criterio contable.

La distinción que estructura todo este módulo es **devengado vs percibido**:

- **Resultado** (devengado): Ventas − Costo de la mercadería vendida − Gastos.
  Mide si el negocio gana plata. La compra de stock NO es gasto acá: es un
  cambio de plata por mercadería; recién pesa cuando esa mercadería se vende
  (por el CMV).
- **Flujo de caja** (percibido): lo que realmente entró y salió. Acá sí pesan
  las compras pagadas, y no pesa lo que se vendió fiado hasta cobrarlo.

Los dos números son correctos y distintos, y el puente entre ambos
(`conciliacion`) es justamente lo que explica el "gané plata pero no la tengo".
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from clientes.models import Cliente, ClienteMovimiento
from compras.models import Compra, CompraPago
from core.mixins import resolver_comercio_activo
from finanzas.models import Gasto
from ventas.models import VentaItem, VentaPago

from .views import _margen_pct, _rango_por_defecto, items_con_costo, ventas_filtradas

def _cmv(ventas):
    """Costo de la mercadería vendida: lo que costó comprar lo que se vendió.

    Sale de `VentaItem.costo_unitario`, que es el costo congelado al momento de
    la venta — no el precio de costo actual del producto, que pudo cambiar."""
    agg = items_con_costo(VentaItem.objects.filter(venta__in=ventas)).aggregate(t=Sum("item_costo"))
    return agg["t"] or Decimal("0")


def _resultado(comercio, ventas, desde, hasta):
    """Estado de resultados del período."""
    ingresos = ventas.aggregate(t=Sum("total"))["t"] or Decimal("0")
    cmv = _cmv(ventas)
    gastos = Gasto.objects.filter(comercio=comercio, fecha__gte=desde, fecha__lte=hasta)
    por_tipo = gastos.aggregate(
        fijos=Sum("monto", filter=Q(tipo="fijo")),
        variables=Sum("monto", filter=Q(tipo="variable")),
    )
    fijos = por_tipo["fijos"] or Decimal("0")
    variables = por_tipo["variables"] or Decimal("0")
    margen_bruto = ingresos - cmv
    return {
        "ingresos": ingresos,
        "cmv": cmv,
        "margen_bruto": margen_bruto,
        "margen_bruto_pct": _margen_pct(ingresos, cmv),
        "gastos_fijos": fijos,
        "gastos_variables": variables,
        "gastos_totales": fijos + variables,
        "resultado": margen_bruto - fijos - variables,
    }


def _flujo(comercio, ventas, desde, hasta):
    """Movimiento real de plata del período."""
    # Cobrado de las ventas del período: el desglose por medio de pago excluye
    # por construcción la parte fiada, que no entró.
    cobrado_ventas = VentaPago.objects.filter(venta__in=ventas).aggregate(t=Sum("monto"))["t"] or Decimal("0")
    # Cobros de fiado (de este período o de meses anteriores).
    cobros_cuenta_corriente = ClienteMovimiento.objects.filter(
        comercio=comercio, tipo="pago", created_at__date__gte=desde, created_at__date__lte=hasta,
    ).aggregate(t=Sum("monto"))["t"] or Decimal("0")

    gastos = Gasto.objects.filter(
        comercio=comercio, fecha__gte=desde, fecha__lte=hasta,
    ).aggregate(t=Sum("monto"))["t"] or Decimal("0")
    pagos_proveedor = CompraPago.objects.filter(
        comercio=comercio, fecha__gte=desde, fecha__lte=hasta,
    ).aggregate(t=Sum("monto"))["t"] or Decimal("0")

    entradas = cobrado_ventas + cobros_cuenta_corriente
    salidas = gastos + pagos_proveedor
    return {
        "cobrado_ventas": cobrado_ventas,
        "cobros_cuenta_corriente": cobros_cuenta_corriente,
        "entradas": entradas,
        "gastos": gastos,
        "pagos_proveedor": pagos_proveedor,
        "salidas": salidas,
        "flujo_neto": entradas - salidas,
    }


class ResultadoView(APIView):
    """Resultado + flujo de caja + puente entre ambos, del período filtrado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        desde, hasta = _rango_por_defecto(request.query_params)
        ventas = ventas_filtradas(comercio, {
            **request.query_params.dict(),
            "fecha_desde": desde.isoformat(), "fecha_hasta": hasta.isoformat(),
        })

        resultado = _resultado(comercio, ventas, desde, hasta)
        flujo = _flujo(comercio, ventas, desde, hasta)

        fiado = ventas.aggregate(t=Sum("monto_cuenta_corriente"))["t"] or Decimal("0")
        # Puente devengado → percibido. La identidad se cumple exacta:
        #   flujo = resultado − fiado + cobros_cc + cmv − pagos_proveedor
        conciliacion = {
            "resultado": resultado["resultado"],
            "ventas_fiadas": fiado,
            "cobros_cuenta_corriente": flujo["cobros_cuenta_corriente"],
            "cmv": resultado["cmv"],
            "pagos_proveedor": flujo["pagos_proveedor"],
            "flujo_neto": flujo["flujo_neto"],
        }

        # Punto de equilibrio: cuánto hay que vender para cubrir los fijos con
        # el margen que deja cada peso vendido. Sin margen positivo no existe.
        margen_ratio = (
            (resultado["margen_bruto"] / resultado["ingresos"]) if resultado["ingresos"] else Decimal("0")
        )
        if margen_ratio > 0:
            punto = resultado["gastos_fijos"] / margen_ratio
            equilibrio = {
                "alcanzable": True,
                "venta_necesaria": punto,
                "venta_real": resultado["ingresos"],
                "diferencia": resultado["ingresos"] - punto,
                "margen_ratio_pct": float(margen_ratio * 100),
            }
        else:
            equilibrio = {
                "alcanzable": False,
                "venta_necesaria": Decimal("0"),
                "venta_real": resultado["ingresos"],
                "diferencia": Decimal("0"),
                "margen_ratio_pct": 0.0,
            }

        items = items_con_costo(
            VentaItem.objects.filter(venta__in=ventas, producto__isnull=False)
        )
        por_categoria = [
            {
                "categoria": f["producto__categoria"] or "Sin categoría",
                "ingresos": f["ingresos"],
                "costo": f["costo"] or Decimal("0"),
                "margen": f["ingresos"] - (f["costo"] or Decimal("0")),
                "margen_pct": _margen_pct(f["ingresos"], f["costo"] or Decimal("0")),
                "participacion_pct": (
                    float(f["ingresos"] / resultado["ingresos"] * 100) if resultado["ingresos"] else 0.0
                ),
            }
            for f in items.values("producto__categoria")
            .annotate(ingresos=Sum("subtotal"), costo=Sum("item_costo"))
            .order_by("-ingresos")[:15]
        ]

        return Response({
            "periodo": {"desde": desde, "hasta": hasta},
            "resultado": resultado,
            "flujo": flujo,
            "conciliacion": conciliacion,
            "equilibrio": equilibrio,
            "por_categoria": por_categoria,
        })


class MensualView(APIView):
    """Últimos N meses cerrados + el actual: ventas, CMV, gastos y resultado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        try:
            meses = min(max(int(request.query_params.get("meses", 12)), 1), 36)
        except ValueError:
            meses = 12

        hoy = timezone.localtime(timezone.now()).date()
        primero_actual = hoy.replace(day=1)
        desde = primero_actual
        for _ in range(meses - 1):
            desde = (desde - timedelta(days=1)).replace(day=1)

        ventas = ventas_filtradas(comercio, {
            "fecha_desde": desde.isoformat(), "fecha_hasta": hoy.isoformat(),
        })

        ingresos_mes = {
            f["mes"]: f["total"]
            for f in ventas.annotate(mes=TruncMonth("created_at")).values("mes").annotate(total=Sum("total"))
        }
        cmv_mes = {
            f["mes"]: f["costo"] or Decimal("0")
            for f in items_con_costo(VentaItem.objects.filter(venta__in=ventas))
            .annotate(mes=TruncMonth("venta__created_at")).values("mes").annotate(costo=Sum("item_costo"))
        }
        gastos_mes = {
            f["mes"]: f["total"]
            for f in Gasto.objects.filter(comercio=comercio, fecha__gte=desde, fecha__lte=hoy)
            .annotate(mes=TruncMonth("fecha")).values("mes").annotate(total=Sum("monto"))
        }

        def _clave(fecha):
            """TruncMonth devuelve date o datetime según el campo de origen."""
            return getattr(fecha, "date", lambda: fecha)() if hasattr(fecha, "hour") else fecha

        ingresos_mes = {_clave(k): v for k, v in ingresos_mes.items()}
        cmv_mes = {_clave(k): v for k, v in cmv_mes.items()}
        gastos_mes = {_clave(k): v for k, v in gastos_mes.items()}

        filas, cursor = [], desde
        while cursor <= primero_actual:
            ingresos = ingresos_mes.get(cursor) or Decimal("0")
            cmv = cmv_mes.get(cursor) or Decimal("0")
            gastos = gastos_mes.get(cursor) or Decimal("0")
            filas.append({
                "mes": cursor,
                "ingresos": ingresos,
                "cmv": cmv,
                "margen_bruto": ingresos - cmv,
                "gastos": gastos,
                "resultado": ingresos - cmv - gastos,
            })
            cursor = (cursor + timedelta(days=32)).replace(day=1)

        return Response({"meses": filas})


def _tramos(dias):
    if dias <= 30:
        return "al_dia"
    if dias <= 60:
        return "d31_60"
    if dias <= 90:
        return "d61_90"
    return "mas_90"


TRAMOS_VACIOS = {"al_dia": Decimal("0"), "d31_60": Decimal("0"),
                 "d61_90": Decimal("0"), "mas_90": Decimal("0")}


class DeudasView(APIView):
    """Antigüedad de lo que te deben y de lo que debés.

    En clientes la antigüedad se calcula aplicando los pagos contra los cargos
    más viejos primero (FIFO), que es como se salda una cuenta corriente en la
    práctica: lo que queda sin cubrir conserva la fecha de su cargo original.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        hoy = timezone.localtime(timezone.now()).date()

        deudores = list(Cliente.objects.filter(comercio=comercio, saldo_actual__gt=0))
        movimientos = ClienteMovimiento.objects.filter(
            comercio=comercio, cliente__in=deudores,
        ).order_by("created_at").values("cliente_id", "tipo", "monto", "created_at")

        por_cliente = {}
        for m in movimientos:
            por_cliente.setdefault(m["cliente_id"], []).append(m)

        cobrar_tramos = dict(TRAMOS_VACIOS)
        detalle_clientes = []
        for cliente in deudores:
            cargos = []  # [(fecha, saldo pendiente de ese cargo)]
            for m in por_cliente.get(cliente.id, []):
                fecha = timezone.localtime(m["created_at"]).date()
                if m["tipo"] in ("cargo", "ajuste"):
                    cargos.append([fecha, m["monto"]])
                elif m["tipo"] == "pago":
                    restante = m["monto"]
                    for cargo in cargos:
                        if restante <= 0:
                            break
                        aplicado = min(cargo[1], restante)
                        cargo[1] -= aplicado
                        restante -= aplicado
                    cargos = [c for c in cargos if c[1] > 0]

            pendientes = [c for c in cargos if c[1] > 0]
            reconstruido = sum((c[1] for c in pendientes), Decimal("0"))
            if reconstruido <= 0:
                # Saldo sin movimientos que lo expliquen (carga inicial o ajuste
                # directo): se cuenta entero como "al día" en vez de perderlo.
                cobrar_tramos["al_dia"] += cliente.saldo_actual
                detalle_clientes.append({
                    "id": cliente.id, "nombre": cliente.nombre,
                    "saldo": cliente.saldo_actual, "dias": 0,
                })
                continue

            # El saldo del cliente manda: si difiere de los movimientos, se
            # prorratea para no inventar deuda que no existe.
            factor = cliente.saldo_actual / reconstruido
            mas_viejo = 0
            for fecha, monto in pendientes:
                dias = (hoy - fecha).days
                mas_viejo = max(mas_viejo, dias)
                cobrar_tramos[_tramos(dias)] += monto * factor
            detalle_clientes.append({
                "id": cliente.id, "nombre": cliente.nombre,
                "saldo": cliente.saldo_actual, "dias": mas_viejo,
            })

        detalle_clientes.sort(key=lambda c: c["saldo"], reverse=True)

        # Proveedores: la deuda real son las compras sin saldar. Se envejece por
        # el vencimiento si lo tiene, y si no por la fecha de la compra.
        pagar_tramos = dict(TRAMOS_VACIOS)
        detalle_proveedores = []
        compras = (
            Compra.objects.filter(comercio=comercio, pagado=False)
            .select_related("proveedor").prefetch_related("pagos")
        )
        for compra in compras:
            saldo = compra.saldo_pendiente
            if saldo <= 0:
                continue
            referencia = compra.fecha_vencimiento or compra.fecha
            dias = (hoy - referencia).days
            pagar_tramos[_tramos(dias)] += saldo
            detalle_proveedores.append({
                "id": compra.id,
                "nombre": compra.proveedor.nombre if compra.proveedor_id else "Sin proveedor",
                "numero_factura": compra.numero_factura,
                "vencimiento": compra.fecha_vencimiento,
                "saldo": saldo,
                "dias": dias,
            })
        detalle_proveedores.sort(key=lambda c: c["saldo"], reverse=True)

        return Response({
            "fecha": hoy,
            "por_cobrar": {
                "total": sum(cobrar_tramos.values(), Decimal("0")),
                "tramos": cobrar_tramos,
                "detalle": detalle_clientes[:20],
            },
            "por_pagar": {
                "total": sum(pagar_tramos.values(), Decimal("0")),
                "tramos": pagar_tramos,
                "detalle": detalle_proveedores[:20],
            },
        })
