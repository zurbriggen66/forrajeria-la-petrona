from decimal import Decimal

from django.db import models
from core.models import BaseModel, TenantModel
from proveedores.models import Proveedor
from productos.models import Producto
from caja.models import CajaSesion, CuentaPago


class Compra(TenantModel):
    """Compra a proveedor. La mercadería entra (suma stock) el día `fecha`,
    pero la plata puede salir mucho después: una compra "fiada" se carga con
    `pagado=False` y se va cancelando con uno o más CompraPago. El egreso
    cuenta el día de cada pago, no el día que llegó la mercadería."""

    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    numero_factura = models.CharField(max_length=40, blank=True)
    fecha = models.DateField()
    # Cuándo hay que pagarla (la compra fiada del 23/08 que vence el 15/09).
    fecha_vencimiento = models.DateField(null=True, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Se mantiene en True cuando los pagos cubren el total. Es un derivado de
    # `pagos` — se conserva como columna porque el listado filtra por él.
    pagado = models.BooleanField(default=False)
    # Sesión de caja de la compra pagada en el acto (histórico). Los pagos
    # posteriores guardan su propia sesión en CompraPago.
    caja_sesion = models.ForeignKey(CajaSesion, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "-fecha"])]

    @property
    def total_pagado(self):
        return sum((p.monto for p in self.pagos.all()), Decimal("0"))

    @property
    def saldo_pendiente(self):
        return self.total - self.total_pagado


class CompraPago(TenantModel):
    """Un pago (total o parcial) de una compra a proveedor.

    `fecha` es la fecha real del pago y es la que manda para las estadísticas:
    la mercadería pudo llegar el 23/08 y la plata salir el 15/09. Es el
    equivalente a Gasto para las compras — de hecho los egresos del negocio
    suman Gasto + CompraPago (ver estadisticas/views.py).
    """

    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name="pagos")
    fecha = models.DateField()
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    cuenta = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    caja_sesion = models.ForeignKey(CajaSesion, on_delete=models.SET_NULL, null=True, blank=True)
    notas = models.CharField(max_length=300, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "fecha"])]


class CompraItem(BaseModel):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    # 4 decimales, igual que Producto.precio_costo — de ahí sale precargado y de
    # ahí vuelve al guardar. Con 2, elegir un producto cuyo costo fuera
    # "2200.0000" y guardar sin tocar nada hacía rechazar la compra entera
    # ("Asegúrese de que no haya más de 2 decimales"), y también toda compra
    # cargada por "pagué en total" cuando el total no dividía justo.
    costo_unitario = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    # subtotal SÍ es plata: dos decimales, como el total de la compra.
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
