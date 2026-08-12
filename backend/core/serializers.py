from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Comercio, EmpleadoTurno, Perfil, UsuarioComercio


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


class EmpleadoTurnoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source="empleado.nombre_completo", read_only=True, default=None)

    class Meta:
        model = EmpleadoTurno
        fields = [
            "id", "empleado", "empleado_nombre", "fecha", "hora_inicio", "hora_fin",
            "notas", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ComercioUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comercio
        fields = ["id", "nombre", "cuit", "direccion", "telefono", "email", "logo_url", "rubro"]
        read_only_fields = ["id"]


class UsuarioComercioSerializer(serializers.ModelSerializer):
    """Usuarios con acceso al comercio activo. La creación se hace vía
    UsuarioComercioInviteSerializer (requiere elegir/crear el User)."""

    email = serializers.EmailField(source="user.email", read_only=True)
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = UsuarioComercio
        fields = ["id", "email", "nombre_completo", "rol", "created_at"]
        read_only_fields = ["id", "email", "nombre_completo", "created_at"]

    @extend_schema_field(str)
    def get_nombre_completo(self, relacion):
        perfil = Perfil.objects.filter(user=relacion.user).first()
        return perfil.nombre_completo if perfil else ""


class UsuarioComercioInviteSerializer(serializers.Serializer):
    """Da de alta un usuario nuevo (o vincula uno existente por email) al
    comercio activo. No hay infraestructura de email en el proyecto, así que
    el Dueño elige una contraseña temporal para comunicarle al empleado."""

    email = serializers.EmailField()
    nombre_completo = serializers.CharField(max_length=200, required=False, allow_blank=True)
    rol = serializers.ChoiceField(choices=Perfil.ROLES, default="Cajero")
    password = serializers.CharField(write_only=True, min_length=6, required=False, allow_blank=True)
