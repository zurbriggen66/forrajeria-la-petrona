from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ComercioActivoView,
    EmpleadoTurnoViewSet,
    MeView,
    PerfilViewSet,
    RespaldoView,
    UsuarioComercioViewSet,
)

router = DefaultRouter()
router.register("vendedores", PerfilViewSet, basename="vendedor")
router.register("empleados-turnos", EmpleadoTurnoViewSet, basename="empleado-turno")
router.register("usuarios", UsuarioComercioViewSet, basename="usuario-comercio")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("comercio/", ComercioActivoView.as_view(), name="comercio-activo"),
    path("respaldo/", RespaldoView.as_view(), name="respaldo"),
    path("", include(router.urls)),
]
