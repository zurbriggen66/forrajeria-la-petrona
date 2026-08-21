from django.urls import path

from .views import ConfirmarView, ConsultarView, CuentaView, UsoView

urlpatterns = [
    path("consultar/", ConsultarView.as_view(), name="asistente-consultar"),
    path("confirmar/", ConfirmarView.as_view(), name="asistente-confirmar"),
    path("uso/", UsoView.as_view(), name="asistente-uso"),
    path("cuenta/", CuentaView.as_view(), name="asistente-cuenta"),
]
