from django.db import models
from core.models import BaseModel, TenantModel
from proveedores.models import Proveedor
from productos.models import Producto
from caja.models import CajaSesion


class Compra(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    numero_factura = models.CharField(max_length=40, blank=True)
    fecha = models.DateField()
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pagado = models.BooleanField(default=False)
    # Si se marca pagada al momento de cargarla y hay una caja abierta, queda
    # atada a esa sesión y genera el egreso correspondiente (ídem Gasto).
    caja_sesion = models.ForeignKey(CajaSesion, on_delete=models.SET_NULL, null=True, blank=True)


class CompraItem(BaseModel):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    costo_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
