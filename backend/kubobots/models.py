from django.db import models
from core.models import TenantModel
from clientes.models import Cliente


class KubobotsCliente(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, null=True, blank=True)
    puntos = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    puntos_historicos = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    liga = models.CharField(max_length=40, blank=True)


class KubobotsMision(TenantModel):
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    objetivo = models.JSONField(null=True, blank=True)
    recompensa = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    activa = models.BooleanField(default=True)


class KubobotsRecompensa(TenantModel):
    nombre = models.CharField(max_length=200)
    costo_puntos = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    activa = models.BooleanField(default=True)


class KubobotsCanje(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    recompensa = models.ForeignKey(KubobotsRecompensa, on_delete=models.SET_NULL, null=True, blank=True)
    puntos = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
