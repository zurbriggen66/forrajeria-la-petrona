from rest_framework.routers import DefaultRouter

from .views import VentaViewSet
from .views_presupuestos import PresupuestoViewSet

router = DefaultRouter()
router.register("ventas", VentaViewSet, basename="venta")
router.register("presupuestos", PresupuestoViewSet, basename="presupuesto")

urlpatterns = router.urls
