from django.db import models

from clientes.models import Cliente
from core.models import BaseModel, Perfil, TenantModel
from productos.models import Producto


class Reparto(TenantModel):
    """Pedido a domicilio: qué se manda, a dónde y cuánto se cobra por llevarlo.

    NO toca stock ni caja: es la hoja de ruta del reparto. Lo que efectivamente
    se cobra se registra como venta en el POS cuando corresponda — así un
    pedido cargado a la mañana no descuenta dos veces el mismo stock.
    """

    ESTADOS = [
        ("pendiente", "pendiente"),
        ("en_camino", "en camino"),
        ("entregado", "entregado"),
        ("cancelado", "cancelado"),
    ]

    # El cliente puede estar en la base (FK) o ser alguien de paso: `cliente_nombre`
    # siempre queda escrito para que el reparto se entienda solo.
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    cliente_nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    destino = models.CharField(max_length=300)
    fecha = models.DateField()
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    repartidor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    notas = models.CharField(max_length=300, blank=True)
    # Totales: se recalculan siempre en el servidor a partir de los ítems.
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    costo_envio = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        indexes = [models.Index(fields=["comercio", "-fecha"])]

    def __str__(self):
        return f"{self.cliente_nombre} — {self.destino}"


class RepartoItem(BaseModel):
    reparto = models.ForeignKey(Reparto, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    # Igual que en VentaItem: si `es_bolsa`, `cantidad` son bolsas cerradas y
    # `precio_unitario` es el precio de la bolsa entera.
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    es_bolsa = models.BooleanField(default=False)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
