from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Comercio, Perfil


class ComercioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comercio
        fields = ["id", "nombre", "rubro", "logo_url", "bloqueado"]


class PerfilMeSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    comercios = serializers.SerializerMethodField()

    class Meta:
        model = Perfil
        fields = ["id", "nombre_completo", "rol", "email", "comercios"]

    @extend_schema_field(ComercioSerializer(many=True))
    def get_comercios(self, perfil):
        from .models import UsuarioComercio

        relaciones = UsuarioComercio.objects.filter(user=perfil.user).select_related("comercio")
        return ComercioSerializer([r.comercio for r in relaciones], many=True).data


class PerfilVendedorSerializer(serializers.ModelSerializer):
    """Listado liviano de perfiles del comercio, para selects de "vendedor"
    en filtros (Historial de ventas, Estadísticas)."""

    class Meta:
        model = Perfil
        fields = ["id", "nombre_completo", "rol"]
