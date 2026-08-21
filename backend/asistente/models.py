from django.conf import settings
from django.db import models

from core.models import TenantModel


class UsoAsistente(TenantModel):
    """Consumo del asistente por sucursal y por día.

    Sirve para dos cosas a la vez: aplicar el límite diario de consultas, y
    saber cuánto se gastó de verdad — que es lo único que permite ponerle
    precio al servicio sin adivinar.

    Los tokens se guardan tal como los informa la API. `cacheados` son los que
    se leyeron de la caché y salen ~10 veces más baratos, así que separarlos
    es lo que hace que el costo estimado se parezca a la factura real.
    """

    fecha = models.DateField()
    consultas = models.IntegerField(default=0)
    tokens_entrada = models.BigIntegerField(default=0)
    tokens_cacheados = models.BigIntegerField(default=0)
    tokens_salida = models.BigIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["comercio", "fecha"], name="uso_asistente_unico_por_dia")
        ]
        indexes = [models.Index(fields=["comercio", "-fecha"])]


class AccionPendiente(TenantModel):
    """Algo que el asistente propuso y todavía no se ejecutó.

    El modelo nunca escribe en la base directamente: cuando el usuario le pide
    cargar un producto o hacer una venta, se guarda acá la propuesta y se
    ejecuta recién cuando una persona la confirma desde la interfaz.

    La propuesta se guarda en el servidor (y no viaja de ida y vuelta por el
    frontend) para que lo que se confirma sea exactamente lo que se mostró.
    Igual, al ejecutar se revalida todo contra la base: los precios salen del
    Producto, no de lo que haya dicho el modelo.
    """

    TIPOS = [("alta_producto", "alta de producto"), ("venta", "venta")]
    ESTADOS = [
        ("pendiente", "pendiente"),
        ("confirmada", "confirmada"),
        ("cancelada", "cancelada"),
    ]

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=30, choices=TIPOS)
    # Lo que se le muestra a la persona antes de confirmar.
    resumen = models.TextField()
    datos = models.JSONField()
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    # Referencia a lo que se creó al confirmar (id de Producto o de Venta).
    resultado_id = models.UUIDField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "estado"])]
