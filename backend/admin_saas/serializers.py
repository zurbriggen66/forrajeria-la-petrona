from rest_framework import serializers

from core.models import Comercio
from telemetria.models import ErrorLog


class ComercioAdminSerializer(serializers.ModelSerializer):
    """Sucursal (Comercio) con KPIs del día, calculados y adjuntados a la
    instancia por ComercioAdminViewSet.list antes de serializar."""

    ventas_hoy = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    caja_abierta = serializers.BooleanField(read_only=True)
    alertas_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Comercio
        fields = [
            "id", "nombre", "direccion", "telefono", "email", "rubro",
            "bloqueado", "bloqueado_motivo", "ventas_hoy", "caja_abierta", "alertas_count",
        ]
        read_only_fields = ["id"]


class ErrorLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorLog
        fields = [
            "id", "user_nombre", "tipo", "mensaje", "modulo", "url", "user_agent", "created_at",
        ]
        read_only_fields = fields
