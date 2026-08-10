from rest_framework.routers import DefaultRouter

from .views import CajaMovimientoViewSet, CajaSesionViewSet, CuentaPagoViewSet

router = DefaultRouter()
router.register("cuentas-pago", CuentaPagoViewSet, basename="cuenta-pago")
router.register("caja/sesiones", CajaSesionViewSet, basename="caja-sesion")
router.register("caja/movimientos", CajaMovimientoViewSet, basename="caja-movimiento")

urlpatterns = router.urls
