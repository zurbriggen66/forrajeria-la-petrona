from decimal import Decimal

from rest_framework import serializers

from .models import CajaMovimiento, CajaSesion, CuentaPago


class CuentaPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuentaPago
        fields = ["id", "nombre", "tipo", "comision_pct", "activo"]


class CajaSesionSerializer(serializers.ModelSerializer):
    cajero_nombre = serializers.CharField(source="cajero.nombre_completo", read_only=True, default=None)

    class Meta:
        model = CajaSesion
        fields = [
            "id", "cajero", "cajero_nombre", "estado",
            "monto_apertura", "monto_cierre", "monto_esperado", "diferencia",
            "fecha_apertura", "fecha_cierre",
        ]
        read_only_fields = fields


class CajaAperturaSerializer(serializers.Serializer):
    monto_apertura = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))


class CajaCierreSerializer(serializers.Serializer):
    monto_cierre = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))


class CajaMovimientoSerializer(serializers.ModelSerializer):
    cuenta_nombre = serializers.CharField(source="cuenta.nombre", read_only=True, default=None)

    class Meta:
        model = CajaMovimiento
        fields = [
            "id", "sesion", "cuenta", "cuenta_nombre", "tipo", "concepto", "monto",
            "transferencia_id", "created_at",
        ]
        read_only_fields = ["id", "sesion", "created_at"]


class CajaMovimientoCreateSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=["ingreso", "egreso"])
    cuenta = serializers.UUIDField(required=False, allow_null=True, default=None)
    concepto = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    monto = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))


class CajaTransferenciaSerializer(serializers.Serializer):
    cuenta_origen = serializers.UUIDField()
    cuenta_destino = serializers.UUIDField()
    monto = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    concepto = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")

    def validate(self, data):
        if data["cuenta_origen"] == data["cuenta_destino"]:
            raise serializers.ValidationError("La cuenta de origen y destino no pueden ser la misma.")
        return data


class CajaContenedorSerializer(serializers.Serializer):
    cuenta = serializers.UUIDField()
    nombre = serializers.CharField()
    tipo = serializers.CharField()
    saldo_turno = serializers.DecimalField(max_digits=14, decimal_places=2)
