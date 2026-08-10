from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from .mixins import TenantViewSet
from .models import Perfil
from .serializers import PerfilMeSerializer, PerfilVendedorSerializer


class MeView(RetrieveAPIView):
    """Perfil del usuario autenticado + comercios que puede operar (para el shell)."""

    serializer_class = PerfilMeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return Perfil.objects.select_related("user").get(user=self.request.user)


class PerfilViewSet(TenantViewSet):
    """Sólo lectura: perfiles del comercio para poblar selects de "vendedor"
    en filtros (Historial de ventas, Estadísticas)."""

    queryset = Perfil.objects.filter(activo=True).order_by("nombre_completo")
    serializer_class = PerfilVendedorSerializer
    http_method_names = ["get", "head", "options"]
