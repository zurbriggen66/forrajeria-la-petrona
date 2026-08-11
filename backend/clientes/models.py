from django.db import models
from core.models import TenantModel, Perfil


class Cliente(TenantModel):
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    celular = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    cuit = models.CharField(max_length=20, blank=True)
    direccion = models.CharField(max_length=300, blank=True)
    tipo = models.CharField(max_length=40, default="consumidor_final")
    saldo_actual = models.DecimalField(max_digits=14, decimal_places=2, default=0)  # cta corriente
    limite_credito = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    kubobots_fid_off = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class ClienteMovimiento(TenantModel):
    """Cuenta corriente del cliente: ventas 'fiadas' (cargo) y pagos que hace
    para saldarlas, ídem ProveedorMovimiento pero en sentido inverso — acá el
    saldo es lo que el cliente le debe al comercio."""
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="movimientos")
    tipo = models.CharField(max_length=30)  # cargo | pago | ajuste
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    referencia = models.CharField(max_length=120, blank=True)


class ClienteAsignacion(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE)
    vendedor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    activo = models.BooleanField(default=True)


class CrmLead(TenantModel):
    nombre = models.CharField(max_length=200, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    estado = models.CharField(max_length=40, default="nuevo")
    notas = models.TextField(blank=True)
