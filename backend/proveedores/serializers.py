from rest_framework import serializers

from .models import FacturaProveedor, PedidoCatalogo, PedidoManual, Proveedor, ProveedorMovimiento


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = [
            "id", "nombre", "cuit", "contacto", "telefono", "email", "direccion",
            "categoria", "condicion_pago", "notas", "saldo_actual", "activo",
        ]
        read_only_fields = ["id", "saldo_actual"]


class ProveedorMovimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProveedorMovimiento
        fields = ["id", "proveedor", "tipo", "monto", "referencia", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProveedorMovimientoCreateSerializer(serializers.Serializer):
    """Pago o ajuste manual a la cuenta corriente (las compras generan su
    propio movimiento automáticamente, ver CompraViewSet)."""

    tipo = serializers.ChoiceField(choices=["pago", "ajuste"])
    monto = serializers.DecimalField(max_digits=14, decimal_places=2)
    referencia = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")

    def validate(self, data):
        if data["tipo"] == "pago" and data["monto"] <= 0:
            raise serializers.ValidationError({"monto": "El pago tiene que ser un monto positivo."})
        return data


class FacturaProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacturaProveedor
        fields = ["id", "proveedor", "numero", "total", "fecha", "archivo_url", "created_at"]
        read_only_fields = ["id", "created_at"]


class PedidoManualSerializer(serializers.ModelSerializer):
    class Meta:
        model = PedidoManual
        fields = ["id", "detalle", "estado", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PedidoCatalogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PedidoCatalogo
        fields = ["id", "proveedor", "datos", "estado", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PedidoSugeridoItemSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    nombre = serializers.CharField()
    proveedor = serializers.UUIDField(allow_null=True)
    proveedor_nombre = serializers.CharField(allow_null=True)
    stock = serializers.DecimalField(max_digits=14, decimal_places=3)
    stock_minimo = serializers.DecimalField(max_digits=14, decimal_places=3)
    cantidad_sugerida = serializers.DecimalField(max_digits=14, decimal_places=3)
