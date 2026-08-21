"""
core — plataforma / tenant / usuarios.
Define las clases base (BaseModel, TenantModel) que usa el resto de las apps.
"""
import uuid
from django.db import models
from django.conf import settings


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantModel(BaseModel):
    """Todo lo que pertenece a un comercio. Filtrar SIEMPRE por comercio en las vistas."""
    comercio = models.ForeignKey("core.Comercio", on_delete=models.CASCADE)

    class Meta:
        abstract = True


class Comercio(BaseModel):
    nombre = models.CharField(max_length=200)
    cuit = models.CharField(max_length=20, blank=True)
    direccion = models.CharField(max_length=300, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    logo_url = models.URLField(blank=True)
    rubro = models.CharField(max_length=50, blank=True)  # kiosco, heladeria, indumentaria...
    activo = models.BooleanField(default=True)
    bloqueado = models.BooleanField(default=False)
    bloqueado_motivo = models.CharField(max_length=300, blank=True)
    kubobots_empleados_enabled = models.BooleanField(default=False)
    kubobots_clientes_enabled = models.BooleanField(default=False)
    kubobots_fid_tasa = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    # Asistente con IA: cuántas consultas por día tiene incluidas esta sucursal.
    # 0 = apagado para este comercio. Es el tope que separa un plan de otro.
    asistente_consultas_diarias = models.IntegerField(default=0)
    # Cuenta de Anthropic propia del comercio. Si está cargada, el consumo lo
    # factura el cliente directamente y no quien administra el sistema. Se
    # guarda cifrada (ver asistente/claves.py) y nunca se devuelve por la API.
    asistente_api_key_cifrada = models.TextField(blank=True, default="")
    # Modelo elegido por el comercio. Vacío = el default del servidor.
    asistente_modelo = models.CharField(max_length=60, blank=True, default="")

    def __str__(self):
        return self.nombre


class Perfil(BaseModel):
    """1:1 con el usuario de Django (settings.AUTH_USER_MODEL)."""
    ROLES = [("Dueño", "Dueño"), ("Administrador", "Administrador"),
             ("Cajero", "Cajero"), ("Repositor", "Repositor")]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="perfil")
    comercio = models.ForeignKey(Comercio, on_delete=models.SET_NULL, null=True, blank=True)
    nombre_completo = models.CharField(max_length=200, blank=True)
    rol = models.CharField(max_length=30, choices=ROLES, default="Cajero")
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre_completo or str(self.user)


class UsuarioComercio(BaseModel):
    """N:M usuario<->comercio con rol (un usuario puede operar varios comercios)."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comercio = models.ForeignKey(Comercio, on_delete=models.CASCADE)
    rol = models.CharField(max_length=30, default="Cajero")

    class Meta:
        unique_together = ("user", "comercio")


class ComercioDispositivo(TenantModel):
    device_id = models.CharField(max_length=100)
    nombre = models.CharField(max_length=100, blank=True)
    ultima_vez = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("comercio", "device_id")


class EmpleadoTurno(TenantModel):
    empleado = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    fecha = models.DateField()
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    notas = models.TextField(blank=True)
