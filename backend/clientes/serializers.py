from rest_framework import serializers

from .models import Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = [
            "id", "nombre", "telefono", "celular", "email", "cuit", "direccion", "tipo",
            "saldo_actual", "limite_credito", "kubobots_fid_off", "activo",
        ]
        read_only_fields = ["id", "saldo_actual"]


class ClienteMovimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClienteMovimiento
        fields = ["id", "cliente", "tipo", "monto", "referencia", "medio_pago", "created_at"]
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
