from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from core.mixins import TenantViewSet

from .models import Cliente
from .serializers import ClienteSerializer


class ClienteViewSet(TenantViewSet):
    """CRUD completo (cuenta corriente, asignaciones) llega en la Fase 6; por
    ahora alcanza y busca para la selección de cliente en el POS."""

    queryset = Cliente.objects.filter(activo=True).order_by("nombre")
    serializer_class = ClienteSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ["nombre", "telefono", "celular"]
