import secrets

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.generics import RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from clientes.models import Cliente
from productos.models import CategoriaProducto, Producto
from proveedores.models import Proveedor
from ventas.models import Venta

from .mixins import TenantViewSet, resolver_comercio_activo
from .models import EmpleadoTurno, Perfil, UsuarioComercio
from .permissions import IsDueño
from .serializers import (
    ComercioUpdateSerializer,
    EmpleadoTurnoSerializer,
    PerfilMeSerializer,
    PerfilVendedorSerializer,
    UsuarioComercioInviteSerializer,
    UsuarioComercioSerializer,
)

User = get_user_model()


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


class EmpleadoTurnoViewSet(TenantViewSet):
    """Turnos programados (Fase 8 — Empleados)."""

    queryset = EmpleadoTurno.objects.all().order_by("fecha", "hora_inicio")
    serializer_class = EmpleadoTurnoSerializer
    filterset_fields = ["empleado", "fecha"]


class ComercioActivoView(RetrieveUpdateAPIView):
    """Datos del comercio activo (Fase 8 — Config: "Datos del comercio")."""

    serializer_class = ComercioUpdateSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return resolver_comercio_activo(self.request)


class UsuarioComercioViewSet(viewsets.ModelViewSet):
    """Usuarios con acceso al comercio activo (Fase 8 — Config: "Usuarios").

    No hereda TenantViewSet porque el alta usa un serializer distinto
    (UsuarioComercioInviteSerializer: crea o vincula el User por email).
    """

    permission_classes = [IsAuthenticated, IsDueño]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        comercio = resolver_comercio_activo(self.request)
        return UsuarioComercio.objects.filter(comercio=comercio).select_related("user").order_by("created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return UsuarioComercioInviteSerializer
        return UsuarioComercioSerializer

    def create(self, request, *args, **kwargs):
        comercio = resolver_comercio_activo(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            user, creado = User.objects.get_or_create(
                email=data["email"], defaults={"username": data["email"]},
            )
            if creado:
                user.set_password(data.get("password") or secrets.token_urlsafe(12))
                user.save(update_fields=["password"])

            if UsuarioComercio.objects.filter(user=user, comercio=comercio).exists():
                raise ValidationError({"email": "Ese usuario ya tiene acceso a este comercio."})

            relacion = UsuarioComercio.objects.create(user=user, comercio=comercio, rol=data["rol"])
            Perfil.objects.get_or_create(
                user=user,
                defaults={
                    "comercio": comercio,
                    "nombre_completo": data.get("nombre_completo") or data["email"],
                    "rol": data["rol"],
                },
            )

        return Response(UsuarioComercioSerializer(relacion).data, status=status.HTTP_201_CREATED)


class RespaldoView(APIView):
    """Export simple del comercio activo en JSON descargable (Fase 8 — Config: "Respaldo").
    Solo lectura, sin restore."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)

        data = {
            "comercio": comercio.nombre,
            "generado": timezone.now().isoformat(),
            "categorias": list(
                CategoriaProducto.objects.filter(comercio=comercio).values("nombre", "orden", "activa")
            ),
            "productos": list(
                Producto.objects.filter(comercio=comercio).values(
                    "codigo_barras", "nombre", "categoria", "subcategoria",
                    "precio_costo", "precio_venta", "stock", "stock_minimo", "activo",
                )
            ),
            "clientes": list(
                Cliente.objects.filter(comercio=comercio).values(
                    "nombre", "telefono", "email", "cuit", "saldo_actual", "activo",
                )
            ),
            "proveedores": list(
                Proveedor.objects.filter(comercio=comercio).values(
                    "nombre", "cuit", "telefono", "email", "saldo_actual", "activo",
                )
            ),
            "ventas_recientes": list(
                Venta.objects.filter(comercio=comercio).order_by("-created_at")[:500].values(
                    "numero_ticket", "total", "metodo_pago", "anulada", "created_at",
                )
            ),
        }

        filename = f"respaldo_{comercio.nombre}_{timezone.localtime().date().isoformat()}.json"
        response = JsonResponse(data, json_dumps_params={"ensure_ascii": False, "indent": 2})
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
