from django.contrib import admin
from .models import ComercioFiscalConfig, FiscalBatch, FiscalQueue

admin.site.register(ComercioFiscalConfig)
admin.site.register(FiscalBatch)
admin.site.register(FiscalQueue)
