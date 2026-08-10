from django.db import models
from core.models import BaseModel, TenantModel
from proveedores.models import Proveedor
from productos.models import Producto


class Compra(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    numero_factura = models.CharField(max_length=40, blank=True)
    fecha = models.DateField()
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pagado = models.BooleanField(default=False)


class CompraItem(BaseModel):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    costo_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
