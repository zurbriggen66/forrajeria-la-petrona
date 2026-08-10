from rest_framework.routers import DefaultRouter

from .views import CuentaPagoViewSet

router = DefaultRouter()
router.register("cuentas-pago", CuentaPagoViewSet, basename="cuenta-pago")

urlpatterns = router.urls
