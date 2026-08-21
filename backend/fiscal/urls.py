from rest_framework.routers import DefaultRouter

from .views import ComercioFiscalConfigViewSet, FiscalQueueViewSet

router = DefaultRouter()
router.register("config", ComercioFiscalConfigViewSet, basename="fiscal-config")
router.register("cola", FiscalQueueViewSet, basename="fiscal-cola")

urlpatterns = router.urls
