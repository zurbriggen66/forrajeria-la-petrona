from decimal import Decimal

from rest_framework import serializers

from .models import Compra, CompraItem


class CompraItemInputSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    costo_unitario = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))


class CompraCreateSerializer(serializers.Serializer):
    """Input para registrar una compra (Fase 5). El total se recalcula en el
    servidor a partir de los ítems — nunca se confía en lo que mande el cliente."""

    proveedor = serializers.UUIDField(required=False, allow_null=True, default=None)
    numero_factura = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    fecha = serializers.DateField()
    pagado = serializers.BooleanField(default=False)
    items = CompraItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("La compra necesita al menos un ítem.")
        return items


class CompraItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True, default=None)

    class Meta:
        model = CompraItem
        fields = ["id", "producto", "producto_nombre", "cantidad", "costo_unitario", "subtotal"]


class CompraSerializer(serializers.ModelSerializer):
    items = CompraItemSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True, default=None)

    class Meta:
        model = Compra
        fields = [
            "id", "proveedor", "proveedor_nombre", "numero_factura", "fecha",
            "total", "pagado", "caja_sesion", "items", "created_at",
        ]
        read_only_fields = ["id", "total", "caja_sesion", "created_at"]
