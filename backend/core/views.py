from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from .models import Perfil
from .serializers import PerfilMeSerializer


class MeView(RetrieveAPIView):
    """Perfil del usuario autenticado + comercios que puede operar (para el shell)."""

    serializer_class = PerfilMeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return Perfil.objects.select_related("user").get(user=self.request.user)
