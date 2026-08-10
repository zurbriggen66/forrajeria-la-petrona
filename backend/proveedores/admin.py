from django.contrib import admin
from .models import Proveedor, ProveedorMovimiento, FacturaProveedor, PedidoCatalogo, PedidoManual

admin.site.register(Proveedor)
admin.site.register(ProveedorMovimiento)
admin.site.register(FacturaProveedor)
admin.site.register(PedidoCatalogo)
admin.site.register(PedidoManual)
