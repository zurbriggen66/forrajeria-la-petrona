from django.contrib import admin
from .models import Venta, VentaItem, Presupuesto, PresupuestoItem

admin.site.register(Venta)
admin.site.register(VentaItem)
admin.site.register(Presupuesto)
admin.site.register(PresupuestoItem)
