from django.db import models
from core.models import BaseModel, TenantModel, Perfil
from productos.models import Producto
from caja.models import CajaSesion, CuentaPago


class Gasto(TenantModel):
    caja_sesion = models.ForeignKey(CajaSesion, on_delete=models.SET_NULL, null=True, blank=True)
    cuenta = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    categoria = models.CharField(max_length=120, blank=True)
    descripcion = models.CharField(max_length=300, blank=True)
    monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha = models.DateField()


class ConsumoInterno(TenantModel):
    persona = models.CharField(max_length=200, blank=True)
    persona_ref = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    tipo_precio = models.CharField(max_length=20, default="costo")  # costo | venta
    total_costo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha = models.DateTimeField(auto_now_add=True)


class ConsumoInternoItem(BaseModel):
    consumo = models.ForeignKey(ConsumoInterno, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    nombre_producto = models.CharField(max_length=200, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    peso_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    unidad_medida = models.CharField(max_length=20, blank=True)
    precio_costo = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    precio_venta = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
