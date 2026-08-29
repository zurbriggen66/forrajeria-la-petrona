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
    # Se cachea en el request porque una misma vista lo llama varias veces
    # (get_queryset, perform_create, y de nuevo dentro del create de cada
    # módulo): sin esto, cada llamada repetía las consultas de abajo.
    cacheado = getattr(request, "_comercio_activo_cache", None)
    if cacheado is not None:
        return cacheado

    user = request.user
    header_comercio_id = request.headers.get("X-Comercio-Id")

    # Una sola consulta y se resuelve en memoria: antes eran hasta tres
    # (filter().first() + count() + count()) para responder lo mismo.
    relaciones = list(UsuarioComercio.objects.filter(user=user).select_related("comercio"))

    if header_comercio_id:
        for relacion in relaciones:
            if str(relacion.comercio_id) == str(header_comercio_id):
                activa = relacion
                break
        else:
            raise PermissionDenied("El usuario no pertenece al comercio indicado en X-Comercio-Id.")
    elif len(relaciones) == 1:
        activa = relaciones[0]
    elif not relaciones:
        raise PermissionDenied("El usuario no está asociado a ningún comercio.")
    else:
        raise PermissionDenied(
            "El usuario opera varios comercios: mandá el header X-Comercio-Id."
        )

    comercio = activa.comercio
    request._comercio_activo_cache = comercio
    # La relación se guarda aparte porque ModuloHabilitado necesita el rol y los
    # módulos bloqueados de ESTE usuario en ESTE comercio, y así no repite la
    # consulta que acabamos de hacer.
    request._usuario_comercio_cache = activa
    return comercio


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
