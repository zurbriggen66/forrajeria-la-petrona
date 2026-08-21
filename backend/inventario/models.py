from django.db import models
from core.models import TenantModel
from productos.models import Producto


class Deposito(TenantModel):
    nombre = models.CharField(max_length=120)
    direccion = models.CharField(max_length=300, blank=True)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class StockDeposito(TenantModel):
    deposito = models.ForeignKey(Deposito, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        unique_together = ("deposito", "producto")
