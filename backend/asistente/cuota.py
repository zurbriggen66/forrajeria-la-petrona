"""Límite diario de consultas y registro de consumo real del asistente.

El límite es por sucursal y por día, y se chequea ANTES de llamar a la API:
una consulta que se pasa del tope no se paga.
"""
from decimal import Decimal

from django.db.models import F
from django.utils import timezone

from .models import UsoAsistente

# US$ por millón de tokens. Las lecturas de caché salen ~10% de la entrada.
# Si Anthropic cambia precios, se actualiza acá y el histórico se recalcula
# solo (el costo no se guarda, se deriva de los tokens).
PRECIOS_USD = {
    "claude-opus-5": {"entrada": Decimal("5.00"), "salida": Decimal("25.00")},
    "claude-sonnet-5": {"entrada": Decimal("3.00"), "salida": Decimal("15.00")},
    "claude-haiku-4-5": {"entrada": Decimal("1.00"), "salida": Decimal("5.00")},
}
DESCUENTO_CACHE = Decimal("0.1")


class CuotaAgotada(Exception):
    """Se acabaron las consultas del día para esta sucursal."""


def _hoy():
    return timezone.localtime(timezone.now()).date()


def uso_de_hoy(comercio):
    uso, _ = UsoAsistente.objects.get_or_create(comercio=comercio, fecha=_hoy())
    return uso


def verificar(comercio):
    """Chequea el cupo antes de gastar. Devuelve cuántas quedan."""
    limite = comercio.asistente_consultas_diarias
    if limite <= 0:
        raise CuotaAgotada(
            "El asistente no está habilitado para esta sucursal. Consultá con quien administra el sistema."
        )
    usadas = uso_de_hoy(comercio).consultas
    if usadas >= limite:
        raise CuotaAgotada(
            f"Ya usaste las {limite} consultas de hoy. Mañana se renuevan."
        )
    return limite - usadas


def registrar(comercio, uso_api):
    """Suma una consulta y sus tokens. `uso_api` viene de la respuesta de la API.

    Se usa F() para que dos consultas simultáneas de la misma sucursal no se
    pisen el contador (que es justamente lo que dejaría pasar consultas de más).
    """
    UsoAsistente.objects.filter(comercio=comercio, fecha=_hoy()).update(
        consultas=F("consultas") + 1,
        tokens_entrada=F("tokens_entrada") + uso_api.get("entrada", 0),
        tokens_cacheados=F("tokens_cacheados") + uso_api.get("cacheados", 0),
        tokens_salida=F("tokens_salida") + uso_api.get("salida", 0),
    )


def costo_usd(uso, modelo):
    """Costo estimado de un registro de uso, en dólares."""
    precios = PRECIOS_USD.get(modelo)
    if precios is None:
        return None
    millon = Decimal("1000000")
    return (
        Decimal(uso.tokens_entrada) / millon * precios["entrada"]
        + Decimal(uso.tokens_cacheados) / millon * precios["entrada"] * DESCUENTO_CACHE
        + Decimal(uso.tokens_salida) / millon * precios["salida"]
    ).quantize(Decimal("0.0001"))


def resumen(comercio, modelo, dias=30):
    """Consumo de los últimos N días: para ver qué se está gastando de verdad."""
    desde = _hoy() - timezone.timedelta(days=dias - 1)
    filas = UsoAsistente.objects.filter(comercio=comercio, fecha__gte=desde).order_by("-fecha")
    total_consultas = sum(f.consultas for f in filas)
    total_usd = sum((costo_usd(f, modelo) or Decimal("0")) for f in filas)
    hoy = uso_de_hoy(comercio)
    limite = comercio.asistente_consultas_diarias
    return {
        "limite_diario": limite,
        "usadas_hoy": hoy.consultas,
        "restantes_hoy": max(limite - hoy.consultas, 0),
        "habilitado": limite > 0,
        "modelo": modelo,
        "ultimos_dias": dias,
        "consultas_periodo": total_consultas,
        "costo_periodo_usd": str(total_usd),
        "costo_promedio_consulta_usd": (
            str((total_usd / total_consultas).quantize(Decimal("0.0001"))) if total_consultas else "0"
        ),
    }
