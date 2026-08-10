from rest_framework import serializers

from .models import Gasto


class GastoSerializer(serializers.ModelSerializer):
    cuenta_nombre = serializers.CharField(source="cuenta.nombre", read_only=True, default=None)
    # UUID de la cuenta de pago elegida al registrar el gasto (validada y
    # resuelta contra el comercio en GastoViewSet, no acá: ídem VentaCreateSerializer).
    cuenta_id = serializers.UUIDField(write_only=True, required=False, allow_null=True, default=None)

    class Meta:
        model = Gasto
        fields = [
            "id", "caja_sesion", "cuenta", "cuenta_nombre", "cuenta_id",
            "categoria", "descripcion", "monto", "fecha", "created_at",
        ]
        read_only_fields = ["id", "caja_sesion", "cuenta", "created_at"]
