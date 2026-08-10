from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MeView, PerfilViewSet

router = DefaultRouter()
router.register("vendedores", PerfilViewSet, basename="vendedor")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
