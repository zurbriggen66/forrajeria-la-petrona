from decimal import Decimal

from rest_framework import serializers

from .models import CajaConteo, CajaMovimiento, CajaSesion, CuentaPago


class CuentaPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuentaPago
        fields = ["id", "nombre", "tipo", "comision_pct", "activo"]


class CajaSesionSerializer(serializers.ModelSerializer):
    cajero_nombre = serializers.CharField(source="cajero.nombre_completo", read_only=True, default=None)
    conteos = serializers.SerializerMethodField()

    def get_conteos(self, sesion):
        return CajaConteoSerializer(sesion.conteos.all(), many=True).data

    class Meta:
        model = CajaSesion
        fields = [
            "id", "cajero", "cajero_nombre", "estado",
            "monto_apertura", "monto_cierre", "monto_esperado", "diferencia",
            "fecha_apertura", "fecha_cierre", "conteos",
        ]
        read_only_fields = fields


class CajaAperturaSerializer(serializers.Serializer):
    monto_apertura = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))


class CajaConteoEntradaSerializer(serializers.Serializer):
    cuenta = serializers.UUIDField()
    contado = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))


class CajaCierreSerializer(serializers.Serializer):
    """Recuento del turno, contenedor por contenedor.

    `monto_cierre` sigue aceptándose por compatibilidad con un cliente viejo
    durante la ventana de despliegue; se interpreta como el recuento del
    efectivo, que es lo único que se puede contar a mano."""

    conteos = CajaConteoEntradaSerializer(many=True, required=False)
    monto_cierre = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0"), required=False,
    )

    def validate(self, data):
        if not data.get("conteos") and data.get("monto_cierre") is None:
            raise serializers.ValidationError(
                "Mandá el recuento de cada contenedor en `conteos`."
            )
        return data


class CajaConteoSerializer(serializers.ModelSerializer):
    cuenta_nombre = serializers.CharField(source="cuenta.nombre", read_only=True, default=None)
    tipo = serializers.CharField(source="cuenta.tipo", read_only=True, default="")
    diferencia = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = CajaConteo
        fields = ["cuenta", "cuenta_nombre", "tipo", "esperado", "contado", "diferencia"]


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
