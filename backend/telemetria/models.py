from django.db import models
from core.models import TenantModel


class AuditLog(TenantModel):
    user_id = models.UUIDField(null=True, blank=True)
    accion = models.CharField(max_length=60, blank=True)
    entidad = models.CharField(max_length=60, blank=True)
    entidad_id = models.UUIDField(null=True, blank=True)
    datos = models.JSONField(null=True, blank=True)


class ErrorLog(TenantModel):
    user_id = models.UUIDField(null=True, blank=True)
    user_nombre = models.CharField(max_length=200, blank=True)
    tipo = models.CharField(max_length=60, blank=True)
    mensaje = models.TextField(blank=True)
    stack = models.TextField(blank=True)
    url = models.CharField(max_length=500, blank=True)
    linea = models.IntegerField(null=True, blank=True)
    columna = models.IntegerField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    modulo = models.CharField(max_length=60, blank=True)


class AlertaLeida(TenantModel):
    user_id = models.UUIDField(null=True, blank=True)
    alerta_key = models.CharField(max_length=120, blank=True)


class UiEvent(TenantModel):
    modulo = models.CharField(max_length=60, blank=True)
    elemento = models.CharField(max_length=120, blank=True)
    x = models.IntegerField(null=True, blank=True)
    y = models.IntegerField(null=True, blank=True)


class UiHeatmap(TenantModel):
    modulo = models.CharField(max_length=60, blank=True)
    fecha = models.DateField(null=True, blank=True)
    viewport_w = models.IntegerField(null=True, blank=True)
    viewport_h = models.IntegerField(null=True, blank=True)
    grid = models.JSONField(null=True, blank=True)
    sesion_count = models.IntegerField(default=0)
