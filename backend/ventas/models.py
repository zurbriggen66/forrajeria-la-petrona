from django.db import models
from core.models import BaseModel, TenantModel, Perfil
from clientes.models import Cliente
from caja.models import CajaSesion, CuentaPago
from productos.models import Producto, Combo


class Venta(TenantModel):
    numero_ticket = models.BigIntegerField(null=True, blank=True)
    # Generado en el cliente al crear la venta (incluso offline). Permite reintentar
    # el envío sin duplicar la venta cuando se sincroniza la cola offline del POS.
    sync_uuid = models.UUIDField(null=True, blank=True)
    vendedor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    caja_sesion = models.ForeignKey(CajaSesion, on_delete=models.SET_NULL, null=True, blank=True)
    cuenta_pago = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    recargo_monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    comision_monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Resumen legible del cobro. El desglose real vive en VentaPago (una fila
    # por medio usado); acá queda "efectivo", el nombre de la cuenta, o
    # "mixto" cuando se pagó con más de una.
    metodo_pago = models.CharField(max_length=40, blank=True)
    monto_efectivo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_tarjeta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_transferencia = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Porción de `total` cargada a la cuenta corriente del cliente ("fiado")
    # en vez de cobrada en el momento: no genera movimiento de caja.
    monto_cuenta_corriente = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    efectivo_recibido = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    vuelto = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    # Cuenta desde la que se dio el vuelto, si fue distinta de la que cobró la
    # venta (ej: cobra en efectivo pero da el vuelto por transferencia porque
    # no hay billetes chicos). Null = se dio en la misma cuenta que cobró, que
    # es el caso normal y no genera movimientos extra de caja.
    vuelto_cuenta_pago = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
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
        indexes = [
            models.Index(fields=["comercio", "-created_at"]),
            # Cada venta calcula su numero_ticket con MAX(numero_ticket) del
            # comercio. Con sólo el índice de comercio_id eso lee todas las
            # ventas del comercio para sacar el máximo: la venta 20.000 tarda
            # 20.000 veces más que la primera. Con el índice compuesto es un
            # solo salto al final del índice.
            models.Index(fields=["comercio", "numero_ticket"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["comercio", "sync_uuid"],
                condition=models.Q(sync_uuid__isnull=False),
                name="unique_venta_sync_uuid_por_comercio",
            )
        ]


class VentaItem(BaseModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    combo = models.ForeignKey(Combo, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    peso_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    # Rebaja pactada sobre ESTE producto ("te hago 10% en el balanceado"),
    # distinta del descuento de Venta que se aplica al total. Se guarda el
    # porcentaje y no el precio ya rebajado para que el servidor siga siendo
    # el único que resuelve el precio de lista contra Producto.
    descuento_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    # Precio de lista, antes del descuento por ítem. `subtotal` sí va neto.
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    costo_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)


class VentaPago(BaseModel):
    """Una línea del cobro: cuánto entró por cada medio de pago.

    Existe para el pago mixto (ej. $48.000 = $30.000 efectivo + $8.000
    transferencia + $10.000 débito). Una fila por cuenta usada, porque cada
    una tiene que generar su propio CajaMovimiento: el arqueo por contenedor
    se calcula sobre `CajaMovimiento.cuenta`, así que meter el total en una
    sola cuenta descuadraría el cierre de caja.

    La parte fiada NO va acá: no es plata que entró, va en
    `Venta.monto_cuenta_corriente`.
    """

    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="pagos")
    cuenta_pago = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    monto = models.DecimalField(max_digits=14, decimal_places=2)


class Presupuesto(TenantModel):
    """Cotización para un cliente: qué se le ofrece y a qué precio, sin mover
    stock ni caja todavía — eso pasa recién si el cliente acepta y se cobra
    (ver PresupuestoViewSet.estado, que linkea la Venta resultante acá)."""

    ESTADOS = [
        ("pendiente", "pendiente"),
        ("aprobado", "aprobado"),
        ("rechazado", "rechazado"),
        ("vencido", "vencido"),
        ("cobrado", "cobrado"),
    ]

    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    cliente_nombre = models.CharField(max_length=200, blank=True)
    numero = models.CharField(max_length=40, blank=True)
    notas = models.CharField(max_length=300, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    validez = models.DateField(null=True, blank=True)
    # Totales: se recalculan siempre en el servidor a partir de los ítems.
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Seteado por PresupuestoViewSet.estado al cobrar: la venta real que se
    # generó a partir de este presupuesto, para poder ir de uno al otro y
    # para que las estadísticas (que sólo miran Venta) vean esta plata.
    venta = models.ForeignKey(Venta, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "-created_at"])]

    def __str__(self):
        return f"{self.numero or self.id} — {self.cliente_nombre}"


class PresupuestoItem(BaseModel):
    presupuesto = models.ForeignKey(Presupuesto, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    es_bolsa = models.BooleanField(default=False)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
