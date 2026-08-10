from decimal import Decimal

from rest_framework import serializers

from .models import Venta, VentaItem


class VentaItemInputSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    peso_kg = serializers.DecimalField(max_digits=14, decimal_places=3, required=False, allow_null=True, default=None)


class VentaCreateSerializer(serializers.Serializer):
    """Input para registrar una venta desde el POS (Fase 2).

    El precio/costo de cada ítem y el total se recalculan en el servidor a
    partir de Producto — nunca se confía en lo que mande el cliente.
    """

    sync_uuid = serializers.UUIDField()
    items = VentaItemInputSerializer(many=True)
    cliente = serializers.UUIDField(required=False, allow_null=True, default=None)
    cuenta_pago = serializers.UUIDField(required=False, allow_null=True, default=None)
    metodo_pago = serializers.CharField(required=False, allow_blank=True, default="")
    monto_efectivo = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_tarjeta = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_transferencia = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    efectivo_recibido = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True, default=None)
    descuento = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    recargo_monto = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    origen = serializers.CharField(required=False, default="pos")

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("La venta necesita al menos un ítem.")
        return items


class VentaItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True, default=None)

    class Meta:
        model = VentaItem
        fields = [
            "id", "producto", "producto_nombre", "combo", "cantidad", "peso_kg",
            "precio_unitario", "costo_unitario", "subtotal",
        ]


class VentaSerializer(serializers.ModelSerializer):
    items = VentaItemSerializer(many=True, read_only=True)
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True, default=None)
    vendedor_nombre = serializers.CharField(source="vendedor.nombre_completo", read_only=True, default=None)
    cuenta_pago_nombre = serializers.CharField(source="cuenta_pago.nombre", read_only=True, default=None)

    class Meta:
        model = Venta
        fields = [
            "id", "numero_ticket", "sync_uuid", "vendedor", "vendedor_nombre",
            "cliente", "cliente_nombre", "cuenta_pago", "cuenta_pago_nombre",
            "total", "descuento", "recargo_monto", "metodo_pago",
            "monto_efectivo", "monto_tarjeta", "monto_transferencia",
            "efectivo_recibido", "vuelto", "origen",
            "anulada", "motivo_anulacion", "fecha_anulacion", "created_at", "items",
        ]


class VentaAnularSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=300, allow_blank=False, trim_whitespace=True)

    def validate_motivo(self, value):
        if not value.strip():
            raise serializers.ValidationError("El motivo de anulación es obligatorio.")
        return value
