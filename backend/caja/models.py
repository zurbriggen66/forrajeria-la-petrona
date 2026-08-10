from django.db import models
from core.models import TenantModel, Perfil


class CuentaPago(TenantModel):
    nombre = models.CharField(max_length=120)  # Efectivo, Tarjeta, MercadoPago, Transferencia
    tipo = models.CharField(max_length=40, blank=True)
    comision_pct = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class CajaSesion(TenantModel):
    ESTADOS = [("abierta", "abierta"), ("cerrada", "cerrada")]
    cajero = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADOS, default="abierta")
    monto_apertura = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_cierre = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    monto_esperado = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    diferencia = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["comercio"],
                condition=models.Q(estado="abierta"),
                name="unique_caja_sesion_abierta_por_comercio",
            )
        ]


class CajaMovimiento(TenantModel):
    sesion = models.ForeignKey(CajaSesion, on_delete=models.CASCADE, null=True, blank=True)
    cuenta = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    tipo = models.CharField(max_length=20)  # ingreso | egreso
    concepto = models.CharField(max_length=200, blank=True)
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    # Comparte el mismo UUID en las dos patas (egreso + ingreso) de una transferencia
    # entre contenedores, para poder mostrarlas agrupadas en el frontend.
    transferencia_id = models.UUIDField(null=True, blank=True)
