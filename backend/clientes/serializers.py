from rest_framework import serializers

from .models import (
    Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead, MEDIOS_PAGO, MovimientoAuditoria,
)


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = [
            "id", "nombre", "telefono", "celular", "email", "cuit", "direccion", "tipo",
            "saldo_actual", "limite_credito", "kubobots_fid_off", "activo",
        ]
        read_only_fields = ["id", "saldo_actual"]


class ClienteMovimientoSerializer(serializers.ModelSerializer):
    cuenta_pago_nombre = serializers.CharField(source="cuenta_pago.nombre", read_only=True, default=None)
    class Meta:
        model = ClienteMovimiento
        fields = ["id", "cliente", "tipo", "monto", "referencia", "medio_pago", "created_at",
            # En qué turno y contenedor entró la plata. null en un cargo o un
            # ajuste (no mueven plata), y también en un pago cargado sin caja
            # abierta — que es justo lo que hay que poder ver.
            "caja_sesion", "cuenta_pago", "cuenta_pago_nombre"]
        read_only_fields = ["id", "created_at"]


class ClienteMovimientoCreateSerializer(serializers.Serializer):
    """Pago o ajuste manual a la cuenta corriente (las ventas fiadas generan
    su propio cargo automáticamente, ver VentaViewSet)."""

    tipo = serializers.ChoiceField(choices=["pago", "ajuste"])
    monto = serializers.DecimalField(max_digits=14, decimal_places=2)
    referencia = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    medio_pago = serializers.ChoiceField(
        choices=["efectivo", "transferencia", "tarjeta"], required=False, allow_blank=True, default="",
    )

    def validate(self, data):
        if data["tipo"] == "pago" and data["monto"] <= 0:
            raise serializers.ValidationError({"monto": "El pago tiene que ser un monto positivo."})
        return data


class ClienteAsignacionSerializer(serializers.ModelSerializer):
    vendedor_nombre = serializers.CharField(source="vendedor.nombre_completo", read_only=True, default=None)

    class Meta:
        model = ClienteAsignacion
        fields = ["id", "cliente", "vendedor", "vendedor_nombre", "activo", "created_at"]
        read_only_fields = ["id", "created_at"]


class CrmLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrmLead
        fields = ["id", "nombre", "telefono", "email", "estado", "notas", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class MovimientoEditarSerializer(serializers.Serializer):
    """Input para corregir o borrar un movimiento de la cuenta corriente.

    `motivo` es obligatorio igual que al anular una venta: cambiarle el saldo a
    un cliente sin dejar dicho por qué es lo que después no se puede explicar.
    Los demás campos sólo aplican al PATCH.
    """

    motivo = serializers.CharField(max_length=300, allow_blank=False, trim_whitespace=True)
    monto = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    referencia = serializers.CharField(max_length=120, required=False, allow_blank=True)
    medio_pago = serializers.ChoiceField(
        choices=[m[0] for m in MEDIOS_PAGO], required=False, allow_blank=True,
    )

    def validate_motivo(self, value):
        if not value.strip():
            raise serializers.ValidationError("Escribí por qué lo estás cambiando.")
        return value.strip()


class MovimientoAuditoriaSerializer(serializers.ModelSerializer):
    hecho_por_nombre = serializers.CharField(
        source="hecho_por.nombre_completo", read_only=True, default=None,
    )

    class Meta:
        model = MovimientoAuditoria
        fields = [
            "id", "cliente", "cliente_nombre", "accion", "motivo", "movimiento_id", "tipo",
            "monto_anterior", "referencia_anterior", "medio_pago_anterior",
            "monto_nuevo", "referencia_nueva", "medio_pago_nuevo",
            "saldo_anterior", "saldo_nuevo", "hecho_por", "hecho_por_nombre", "created_at",
        ]
