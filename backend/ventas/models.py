from django.db import models
from core.models import BaseModel, TenantModel, Perfil
from clientes.models import Cliente
from caja.models import CajaSesion, CuentaPago
from productos.models import Producto, Combo


class Venta(TenantModel):
    numero_ticket = models.BigIntegerField(null=True, blank=True)
    vendedor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    caja_sesion = models.ForeignKey(CajaSesion, on_delete=models.SET_NULL, null=True, blank=True)
    cuenta_pago = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    recargo_monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    comision_monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    metodo_pago = models.CharField(max_length=40, blank=True)  # efectivo|tarjeta|transferencia|mixto
    monto_efectivo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_tarjeta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_transferencia = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    efectivo_recibido = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    vuelto = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    origen = models.CharField(max_length=40, default="pos")
    # anulación (NUNCA borrar una venta)
    anulada = models.BooleanField(default=False)
    motivo_anulacion = models.CharField(max_length=300, blank=True)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    # fiscal
    facturado = models.BooleanField(default=False)
    excluir_fiscal = models.BooleanField(default=False)
    cae = models.CharField(max_length=40, blank=True)
    cae_vencimiento = models.DateField(null=True, blank=True)
    tipo_factura = models.CharField(max_length=5, blank=True)  # A | B | C
    numero_factura = models.CharField(max_length=40, blank=True)
    punto_venta_factura = models.CharField(max_length=20, blank=True)
    fecha_facturacion = models.DateTimeField(null=True, blank=True)
    comprador_fiscal = models.CharField(max_length=200, blank=True)
    comprador_datos = models.JSONField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "-created_at"])]


class VentaItem(BaseModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    combo = models.ForeignKey(Combo, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    peso_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    costo_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)


class Presupuesto(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    numero = models.CharField(max_length=40, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    estado = models.CharField(max_length=40, default="pendiente")
    validez = models.DateField(null=True, blank=True)


class PresupuestoItem(BaseModel):
    presupuesto = models.ForeignKey(Presupuesto, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
