"""Herramientas que el asistente puede usar para responder sobre el negocio.

Dos reglas que no se negocian:

1. TODO consulta filtra por el comercio activo. Las funciones reciben el
   `comercio` como primer argumento y nunca lo toman de lo que dice el modelo:
   si el id del comercio fuera un parámetro de la herramienta, alcanzaría con
   que el modelo lo inventara para leer datos de otra sucursal.

2. Las herramientas de acá SOLO LEEN. Crear productos o registrar ventas no
   se ejecuta desde el bucle del modelo: se propone y lo confirma una persona
   (ver views.py y el modelo AccionPendiente).
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.utils import timezone

from caja.models import CajaMovimiento, CajaSesion
from clientes.models import Cliente
from productos.models import Producto
from ventas.models import Venta, VentaItem


def _rango(desde=None, hasta=None):
    """Interpreta el rango pedido. Por defecto, hoy — en hora local del
    comercio, no UTC (de noche no son el mismo día)."""
    hoy = timezone.localtime(timezone.now()).date()
    return (desde or hoy.isoformat(), hasta or hoy.isoformat())


def _ventas(comercio, desde, hasta):
    return Venta.objects.filter(
        comercio=comercio, anulada=False,
        created_at__date__gte=desde, created_at__date__lte=hasta,
    )


def resumen_ventas(comercio, desde=None, hasta=None):
    desde, hasta = _rango(desde, hasta)
    ventas = _ventas(comercio, desde, hasta)
    agg = ventas.aggregate(ingresos=Sum("total"), cantidad=Count("id"))
    ingresos = agg["ingresos"] or Decimal("0")
    cantidad = agg["cantidad"] or 0
    return {
        "desde": desde,
        "hasta": hasta,
        "ingresos_totales": str(ingresos),
        "cantidad_de_ventas": cantidad,
        "ticket_promedio": str(ingresos / cantidad) if cantidad else "0",
    }


def buscar_producto(comercio, texto):
    productos = Producto.objects.filter(comercio=comercio, activo=True).filter(
        nombre__icontains=texto
    )[:10]
    if not productos:
        return {"encontrados": 0, "productos": [], "nota": f'No hay productos que coincidan con "{texto}".'}
    return {
        "encontrados": len(productos),
        "productos": [
            {
                "id": str(p.id),
                "nombre": p.nombre,
                "precio_venta": str(p.precio_venta),
                "se_vende_por_peso": p.venta_por_peso,
                "unidad": p.unidad_medida,
                "stock": str(p.stock),
                "precio_bolsa": str(p.precio_bolsa) if p.precio_bolsa else None,
                "kg_por_bolsa": str(p.bolsa_kg) if p.bolsa_kg else None,
            }
            for p in productos
        ],
    }


def productos_sin_stock_o_bajos(comercio):
    qs = Producto.objects.filter(comercio=comercio, activo=True).filter(
        stock__lte=F("stock_minimo")
    ).order_by("stock")[:30]
    return {
        "cantidad": len(qs),
        "productos": [
            {
                "nombre": p.nombre,
                "stock": str(p.stock),
                "stock_minimo": str(p.stock_minimo),
                "estado": "sin stock" if p.stock <= 0 else "stock bajo",
            }
            for p in qs
        ],
    }


def productos_mas_vendidos(comercio, desde=None, hasta=None, limite=10):
    desde, hasta = _rango(desde, hasta)
    filas = (
        VentaItem.objects.filter(venta__in=_ventas(comercio, desde, hasta), producto__isnull=False)
        .values("producto__nombre")
        .annotate(cantidad=Sum("cantidad"), ingresos=Sum("subtotal"))
        .order_by("-ingresos")[: min(int(limite), 20)]
    )
    return {
        "desde": desde, "hasta": hasta,
        "productos": [
            {"nombre": f["producto__nombre"], "cantidad_vendida": str(f["cantidad"]), "ingresos": str(f["ingresos"])}
            for f in filas
        ],
    }


def saldo_de_cliente(comercio, nombre):
    clientes = Cliente.objects.filter(comercio=comercio, nombre__icontains=nombre)[:5]
    if not clientes:
        return {"encontrados": 0, "nota": f'No hay clientes que coincidan con "{nombre}".'}
    return {
        "encontrados": len(clientes),
        "clientes": [
            {
                "nombre": c.nombre,
                "saldo_actual": str(c.saldo_actual),
                "limite_credito": str(c.limite_credito),
                "disponible": str(c.limite_credito - c.saldo_actual),
                "interpretacion": "debe" if c.saldo_actual > 0 else "al día",
            }
            for c in clientes
        ],
    }


def estado_de_caja(comercio):
    sesion = CajaSesion.objects.filter(comercio=comercio, estado="abierta").first()
    if sesion is None:
        return {"caja_abierta": False, "nota": "No hay una caja abierta en este momento."}
    movimientos = CajaMovimiento.objects.filter(sesion=sesion)
    ingresos = movimientos.filter(tipo="ingreso").aggregate(t=Sum("monto"))["t"] or Decimal("0")
    egresos = movimientos.filter(tipo="egreso").aggregate(t=Sum("monto"))["t"] or Decimal("0")
    return {
        "caja_abierta": True,
        "abierta_desde": timezone.localtime(sesion.fecha_apertura).strftime("%d/%m/%Y %H:%M"),
        "monto_apertura": str(sesion.monto_apertura),
        "ingresos_del_turno": str(ingresos),
        "egresos_del_turno": str(egresos),
        "saldo_esperado": str(sesion.monto_apertura + ingresos - egresos),
    }


def comparar_con_periodo_anterior(comercio, dias=7):
    """Cuánto se vendió en los últimos N días contra los N anteriores."""
    dias = max(1, min(int(dias), 90))
    hoy = timezone.localtime(timezone.now()).date()
    inicio_actual = hoy - timedelta(days=dias - 1)
    fin_anterior = inicio_actual - timedelta(days=1)
    inicio_anterior = fin_anterior - timedelta(days=dias - 1)

    def total(desde, hasta):
        return _ventas(comercio, desde.isoformat(), hasta.isoformat()).aggregate(
            t=Sum("total"), c=Count("id")
        )

    actual, anterior = total(inicio_actual, hoy), total(inicio_anterior, fin_anterior)
    ingresos_actual = actual["t"] or Decimal("0")
    ingresos_anterior = anterior["t"] or Decimal("0")
    variacion = (
        str(round(float((ingresos_actual - ingresos_anterior) / ingresos_anterior * 100), 1)) + "%"
        if ingresos_anterior else "sin datos del período anterior para comparar"
    )
    return {
        "periodo_actual": {
            "desde": inicio_actual.isoformat(), "hasta": hoy.isoformat(),
            "ingresos": str(ingresos_actual), "ventas": actual["c"] or 0,
        },
        "periodo_anterior": {
            "desde": inicio_anterior.isoformat(), "hasta": fin_anterior.isoformat(),
            "ingresos": str(ingresos_anterior), "ventas": anterior["c"] or 0,
        },
        "variacion_ingresos": variacion,
    }


# Mapa nombre-de-herramienta -> función. El ejecutor le pasa el comercio.
LECTURA = {
    "resumen_ventas": resumen_ventas,
    "buscar_producto": buscar_producto,
    "productos_sin_stock_o_bajos": productos_sin_stock_o_bajos,
    "productos_mas_vendidos": productos_mas_vendidos,
    "saldo_de_cliente": saldo_de_cliente,
    "estado_de_caja": estado_de_caja,
    "comparar_con_periodo_anterior": comparar_con_periodo_anterior,
}

# Esquemas que ve el modelo. El orden es fijo a propósito: la caché de prompt
# es un match de prefijo y una lista que cambia de orden la invalida entera.
ESQUEMAS = [
    {
        "name": "resumen_ventas",
        "description": (
            "Cuánto se vendió en un rango de fechas: ingresos totales, cantidad de ventas y "
            "ticket promedio. Sin fechas, responde por el día de hoy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "desde": {"type": "string", "description": "Fecha inicial AAAA-MM-DD. Omitir para hoy."},
                "hasta": {"type": "string", "description": "Fecha final AAAA-MM-DD. Omitir para hoy."},
            },
        },
    },
    {
        "name": "buscar_producto",
        "description": (
            "Busca productos por nombre y devuelve precio, stock y, si se vende a granel, "
            "el precio por kilo y el de la bolsa cerrada. Usar antes de proponer una venta."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"texto": {"type": "string", "description": "Parte del nombre del producto."}},
            "required": ["texto"],
        },
    },
    {
        "name": "productos_sin_stock_o_bajos",
        "description": "Lista los productos que están sin stock o por debajo de su stock mínimo.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "productos_mas_vendidos",
        "description": "Ranking de los productos que más facturaron en un rango de fechas.",
        "input_schema": {
            "type": "object",
            "properties": {
                "desde": {"type": "string", "description": "Fecha inicial AAAA-MM-DD. Omitir para hoy."},
                "hasta": {"type": "string", "description": "Fecha final AAAA-MM-DD. Omitir para hoy."},
                "limite": {"type": "integer", "description": "Cuántos devolver (máximo 20)."},
            },
        },
    },
    {
        "name": "saldo_de_cliente",
        "description": "Cuánto debe un cliente en su cuenta corriente y cuánto crédito le queda.",
        "input_schema": {
            "type": "object",
            "properties": {"nombre": {"type": "string", "description": "Parte del nombre del cliente."}},
            "required": ["nombre"],
        },
    },
    {
        "name": "estado_de_caja",
        "description": "Si hay una caja abierta, desde cuándo, y cuánto debería haber según los movimientos del turno.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "comparar_con_periodo_anterior",
        "description": "Compara las ventas de los últimos N días contra los N días anteriores.",
        "input_schema": {
            "type": "object",
            "properties": {"dias": {"type": "integer", "description": "Cantidad de días de cada período (por defecto 7)."}},
        },
    },
    # --- Acciones: NO se ejecutan acá. Devuelven una propuesta que confirma
    # una persona desde la interfaz (ver views.py::_proponer). ---
    {
        "name": "proponer_alta_de_producto",
        "description": (
            "Prepara el alta de un producto para que el usuario la confirme. NO lo crea: "
            "devuelve una propuesta. Pedí los datos que falten antes de llamar a esto."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string"},
                "precio_venta": {"type": "string", "description": "Precio de venta. Si es a granel, por kilo."},
                "precio_costo": {"type": "string"},
                "stock": {"type": "string"},
                "categoria": {"type": "string"},
                "venta_por_peso": {"type": "boolean", "description": "true si se vende suelto por kilo."},
                "bolsa_kg": {"type": "string", "description": "Kilos por bolsa cerrada, si además se vende así."},
                "precio_bolsa": {"type": "string", "description": "Precio de la bolsa cerrada."},
            },
            "required": ["nombre", "precio_venta"],
        },
    },
    {
        "name": "proponer_venta",
        "description": (
            "Prepara una venta para que el usuario la confirme. NO la registra ni cobra: "
            "devuelve una propuesta. Buscá cada producto primero para usar su id real."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "description": "Productos de la venta.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "producto_id": {"type": "string", "description": "id devuelto por buscar_producto."},
                            "cantidad": {"type": "string", "description": "Kilos o unidades. Si es_bolsa, cantidad de bolsas."},
                            "es_bolsa": {"type": "boolean", "description": "true si compra bolsas cerradas."},
                        },
                        "required": ["producto_id", "cantidad"],
                    },
                },
            },
            "required": ["items"],
        },
    },
]
