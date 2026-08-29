from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from .models import Perfil
from .modulos import modulo_de_ruta


class IsDueño(BasePermission):
    """Gestión de sucursales, usuarios y error logs: solo el rol Dueño."""

    message = "Esta acción requiere el rol Dueño."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        perfil = Perfil.objects.filter(user=request.user).first()
        return perfil is not None and perfil.rol == "Dueño"


class ModuloHabilitado(BasePermission):
    """Corta las requests a un módulo que el Dueño le apagó al empleado.

    El menú del frontend ya esconde el módulo; esto es lo que hace que
    esconderlo sirva de algo — sin esto alcanza con escribir la URL a mano.

    Sólo mira las rutas exclusivas de un módulo (ver core/modulos.py): los
    endpoints que el POS también usa nunca se bloquean, porque un cajero sin
    "Productos" habilitado igual tiene que poder buscar qué está vendiendo.
    """

    message = "Tu usuario no tiene habilitado este módulo. Pedíselo al dueño del comercio."

    def has_permission(self, request, view):
        modulo = modulo_de_ruta(request.path)
        if modulo is None:
            return True
        if not request.user or not request.user.is_authenticated:
            return True  # el 401 lo tira IsAuthenticated, no es asunto de acá

        # Import adentro: core.mixins arrastra rest_framework.viewsets, y esta
        # clase la carga DRF mientras todavía se está inicializando a sí mismo.
        from .mixins import resolver_comercio_activo

        try:
            resolver_comercio_activo(request)
        except PermissionDenied:
            return True  # el problema es de comercio, no de módulo: que lo reporte quien corresponde

        relacion = getattr(request, "_usuario_comercio_cache", None)
        if relacion is None or relacion.rol == "Dueño":
            return True
        return modulo not in (relacion.modulos_bloqueados or [])
