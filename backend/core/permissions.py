from rest_framework.permissions import BasePermission

from .models import Perfil


class IsDueño(BasePermission):
    """Gestión de sucursales, usuarios y error logs: solo el rol Dueño."""

    message = "Esta acción requiere el rol Dueño."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        perfil = Perfil.objects.filter(user=request.user).first()
        return perfil is not None and perfil.rol == "Dueño"
