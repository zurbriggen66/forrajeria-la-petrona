from django.contrib import admin
from .models import CuentaPago, CajaSesion, CajaMovimiento

admin.site.register(CuentaPago)
admin.site.register(CajaSesion)
admin.site.register(CajaMovimiento)
