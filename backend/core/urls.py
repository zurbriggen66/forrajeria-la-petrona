from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CambiarPasswordView,
    ComercioActivoView,
    EmpleadoTurnoViewSet,
    MeView,
    MiUsuarioView,
    PerfilViewSet,
    RespaldoView,
    UsuarioComercioViewSet,
    WhatsAppDesconectarView,
    WhatsAppEstadoView,
)

router = DefaultRouter()
router.register("vendedores", PerfilViewSet, basename="vendedor")
router.register("empleados-turnos", EmpleadoTurnoViewSet, basename="empleado-turno")
router.register("usuarios", UsuarioComercioViewSet, basename="usuario-comercio")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/usuario/", MiUsuarioView.as_view(), name="mi-usuario"),
    path("me/password/", CambiarPasswordView.as_view(), name="cambiar-password"),
    path("comercio/", ComercioActivoView.as_view(), name="comercio-activo"),
    path("respaldo/", RespaldoView.as_view(), name="respaldo"),
    path("whatsapp/estado/", WhatsAppEstadoView.as_view(), name="whatsapp-estado"),
    path("whatsapp/desconectar/", WhatsAppDesconectarView.as_view(), name="whatsapp-desconectar"),
    path("", include(router.urls)),
]
