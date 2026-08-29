from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Comercio, EmpleadoTurno, Perfil, UsuarioComercio
from .modulos import CLAVES


class ComercioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comercio
        fields = ["id", "nombre", "rubro", "logo_url", "bloqueado"]


class PerfilMeSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    comercios = serializers.SerializerMethodField()
    modulos_bloqueados = serializers.SerializerMethodField()

    class Meta:
        model = Perfil
        fields = ["id", "nombre_completo", "rol", "email", "username", "comercios",
                  "modulos_bloqueados"]

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_modulos_bloqueados(self, perfil):
        """Módulos que el Dueño le apagó a este usuario en el comercio activo.
        El frontend los usa para no dibujar el menú ni las rutas."""
        from .mixins import resolver_comercio_activo
        from .models import UsuarioComercio

        request = self.context.get("request")
        if request is None:
            return []
        try:
            comercio = resolver_comercio_activo(request)
        except Exception:  # noqa: BLE001 - sin comercio resuelto no hay nada que esconder
            return []
        relacion = UsuarioComercio.objects.filter(user=perfil.user, comercio=comercio).first()
        if relacion is None or relacion.rol == "Dueño":
            return []
        return relacion.modulos_bloqueados or []

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
        fields = [
            "id", "nombre", "cuit", "direccion", "telefono", "email", "logo_url", "rubro",
            "permitir_venta_sin_stock",
        ]
        read_only_fields = ["id"]


class UsuarioComercioSerializer(serializers.ModelSerializer):
    """Usuarios con acceso al comercio activo. La creación se hace vía
    UsuarioComercioInviteSerializer (requiere elegir/crear el User)."""

    email = serializers.EmailField(source="user.email", read_only=True)
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = UsuarioComercio
        fields = ["id", "email", "nombre_completo", "rol", "modulos_bloqueados", "created_at"]
        read_only_fields = ["id", "email", "nombre_completo", "created_at"]

    @extend_schema_field(str)
    def get_nombre_completo(self, relacion):
        perfil = Perfil.objects.filter(user=relacion.user).first()
        return perfil.nombre_completo if perfil else ""

    def validate_modulos_bloqueados(self, value):
        """Sólo claves del catálogo: un JSONField acepta cualquier cosa, y una
        clave inventada quedaría guardada sin bloquear nada."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Tiene que ser una lista de módulos.")
        desconocidas = [c for c in value if c not in CLAVES]
        if desconocidas:
            raise serializers.ValidationError(f"Módulos que no existen: {', '.join(map(str, desconocidas))}.")
        return sorted(set(value))


class UsuarioComercioInviteSerializer(serializers.Serializer):
    """Da de alta un usuario nuevo (o vincula uno existente por email) al
    comercio activo. No hay infraestructura de email en el proyecto, así que
    el Dueño elige una contraseña temporal para comunicarle al empleado."""

    email = serializers.EmailField()
    nombre_completo = serializers.CharField(max_length=200, required=False, allow_blank=True)
    rol = serializers.ChoiceField(choices=Perfil.ROLES, default="Cajero")
    password = serializers.CharField(write_only=True, min_length=6, required=False, allow_blank=True)


class CambiarUsuarioSerializer(serializers.Serializer):
    """Cambia el nombre de usuario (login) del usuario autenticado — no
    confundir con el email, que es un dato aparte del comercio."""

    username = serializers.CharField(max_length=150)

    def validate_username(self, value):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        if User.objects.filter(username=value).exclude(pk=self.context["user"].pk).exists():
            raise serializers.ValidationError("Ya hay otro usuario con ese nombre de usuario.")
        return value


class CambiarPasswordSerializer(serializers.Serializer):
    password_actual = serializers.CharField(write_only=True)
    password_nueva = serializers.CharField(write_only=True, min_length=6)

    def validate_password_actual(self, value):
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return value
