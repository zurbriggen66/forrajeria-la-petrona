from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DepositoViewSet, InventarioResumenView, RankingRentabilidadView, StockDepositoViewSet

router = DefaultRouter()
router.register("depositos", DepositoViewSet, basename="deposito")
router.register("stock-deposito", StockDepositoViewSet, basename="stock-deposito")

urlpatterns = [
    path("resumen/", InventarioResumenView.as_view(), name="inventario-resumen"),
    path("ranking-rentabilidad/", RankingRentabilidadView.as_view(), name="inventario-ranking"),
] + router.urls
