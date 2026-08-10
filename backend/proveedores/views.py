from core.mixins import TenantViewSet

from .models import Proveedor
from .serializers import ProveedorSerializer


class ProveedorViewSet(TenantViewSet):
    """CRUD completo se implementa en la Fase 5 del ROADMAP; por ahora se usa
    de sólo lectura/alta simple para poblar selects (ej. alta de productos)."""

    queryset = Proveedor.objects.all().order_by("nombre")
    serializer_class = ProveedorSerializer
    filterset_fields = ["activo"]
