from django.db import models
from core.models import TenantModel
from ventas.models import Venta


class ComercioFiscalConfig(TenantModel):
    cuit = models.CharField(max_length=20, blank=True)
    razon_social = models.CharField(max_length=200, blank=True)
    punto_venta = models.CharField(max_length=20, blank=True)
    condicion_iva = models.CharField(max_length=60, blank=True)
    es_principal = models.BooleanField(default=False)
    # OJO: el certificado/clave AFIP NO va en texto plano acá. Guardar en un secret store
    # (variables de entorno, django-environ, o un gestor de secretos) y referenciar acá.
    cert_ref = models.CharField(max_length=200, blank=True)
    activo = models.BooleanField(default=True)


class FiscalBatch(TenantModel):
    status = models.CharField(max_length=30, default="pendiente")
    cantidad = models.IntegerField(default=0)


class FiscalQueue(TenantModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, null=True, blank=True)
    batch = models.ForeignKey(FiscalBatch, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=30, default="pendiente")  # pendiente|procesando|ok|error
    cae = models.CharField(max_length=40, blank=True)
    cae_vencimiento = models.DateField(null=True, blank=True)
    punto_venta = models.CharField(max_length=20, blank=True)
    numero_factura = models.CharField(max_length=40, blank=True)
    tipo_comprobante = models.CharField(max_length=20, blank=True)
    error_msg = models.TextField(blank=True)
