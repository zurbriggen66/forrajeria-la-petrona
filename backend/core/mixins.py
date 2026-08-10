"""
Aislamiento multi-tenant por comercio, resuelto SIEMPRE en el backend (nunca desde el front).

Un usuario pertenece a uno o varios comercios vía UsuarioComercio. El comercio activo
se resuelve así:
  1. Si el usuario opera un solo comercio -> ese es el activo.
  2. Si opera varios -> debe mandar el header `X-Comercio-Id`, validado contra UsuarioComercio.
"""
from rest_framework.exceptions import PermissionDenied
from rest_framework import viewsets

from .models import UsuarioComercio


def resolver_comercio_activo(request):
    user = request.user
    header_comercio_id = request.headers.get("X-Comercio-Id")

    relaciones = UsuarioComercio.objects.filter(user=user).select_related("comercio")

    if header_comercio_id:
        relacion = relaciones.filter(comercio_id=header_comercio_id).first()
        if relacion is None:
            raise PermissionDenied("El usuario no pertenece al comercio indicado en X-Comercio-Id.")
        return relacion.comercio

    if relaciones.count() == 1:
        return relaciones.first().comercio

    if relaciones.count() == 0:
        raise PermissionDenied("El usuario no está asociado a ningún comercio.")

    raise PermissionDenied(
        "El usuario opera varios comercios: mandá el header X-Comercio-Id."
    )


class TenantViewSet(viewsets.ModelViewSet):
    """Filtra TODO queryset por el comercio del usuario autenticado y lo setea al crear.

    Las apps del dominio heredan de esto en vez de ModelViewSet directamente.
    """

    def get_queryset(self):
        comercio = resolver_comercio_activo(self.request)
        return super().get_queryset().filter(comercio=comercio)

    def perform_create(self, serializer):
        comercio = resolver_comercio_activo(self.request)
        serializer.save(comercio=comercio)
