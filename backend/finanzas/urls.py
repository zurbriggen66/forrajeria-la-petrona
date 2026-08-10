from rest_framework.routers import DefaultRouter

from .views import GastoViewSet

router = DefaultRouter()
router.register("gastos", GastoViewSet, basename="gasto")

urlpatterns = router.urls
