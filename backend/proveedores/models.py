from django.db import models
from core.models import BaseModel, TenantModel


class Proveedor(TenantModel):
    nombre = models.CharField(max_length=200)
    cuit = models.CharField(max_length=20, blank=True)
    contacto = models.CharField(max_length=200, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.CharField(max_length=300, blank=True)
    categoria = models.CharField(max_length=120, blank=True)
    condicion_pago = models.CharField(max_length=100, blank=True)
    notas = models.TextField(blank=True)
    saldo_actual = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    instrucciones_parseo = models.TextField(blank=True)  # parseo automático de facturas
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class ProveedorMovimiento(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE, related_name="movimientos")
    tipo = models.CharField(max_length=30)  # compra | pago | ajuste
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    referencia = models.CharField(max_length=120, blank=True)


class FacturaProveedor(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    numero = models.CharField(max_length=40, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha = models.DateField(null=True, blank=True)
    archivo_url = models.URLField(blank=True)
    parseado = models.JSONField(null=True, blank=True)


class PedidoCatalogo(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    datos = models.JSONField(null=True, blank=True)
    estado = models.CharField(max_length=40, default="borrador")


class PedidoManual(TenantModel):
    detalle = models.JSONField(null=True, blank=True)
    estado = models.CharField(max_length=40, default="pendiente")
