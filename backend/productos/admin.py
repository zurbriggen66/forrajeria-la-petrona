from django.contrib import admin
from .models import CategoriaProducto, SubcategoriaProducto, ProductoUniversal, Producto, ProductGroup, ListaPrecio, DescuentoCantidad, AjustePrecio, Combo, ComboItem

admin.site.register(CategoriaProducto)
admin.site.register(SubcategoriaProducto)
admin.site.register(ProductoUniversal)
admin.site.register(Producto)
admin.site.register(ProductGroup)
admin.site.register(ListaPrecio)
admin.site.register(DescuentoCantidad)
admin.site.register(AjustePrecio)
admin.site.register(Combo)
admin.site.register(ComboItem)
