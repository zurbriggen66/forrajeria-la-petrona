from rest_framework.routers import DefaultRouter

from .views import RepartoViewSet

router = DefaultRouter()
router.register("repartos", RepartoViewSet, basename="reparto")

urlpatterns = router.urls
