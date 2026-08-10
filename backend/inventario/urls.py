from django.urls import path

from .views import InventarioResumenView, RankingRentabilidadView

urlpatterns = [
    path("resumen/", InventarioResumenView.as_view(), name="inventario-resumen"),
    path("ranking-rentabilidad/", RankingRentabilidadView.as_view(), name="inventario-ranking"),
]
