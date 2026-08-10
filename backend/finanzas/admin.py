from django.contrib import admin
from .models import Gasto, ConsumoInterno, ConsumoInternoItem

admin.site.register(Gasto)
admin.site.register(ConsumoInterno)
admin.site.register(ConsumoInternoItem)
