from rest_framework.routers import DefaultRouter

from .views import ComercioAdminViewSet, ErrorLogViewSet

router = DefaultRouter()
router.register("comercios", ComercioAdminViewSet, basename="comercio-admin")
router.register("error-logs", ErrorLogViewSet, basename="error-log")

urlpatterns = router.urls
