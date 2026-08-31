from decimal import Decimal

from rest_framework import serializers

from .models import Compra, CompraItem, CompraPago


class CompraItemInputSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    # 4 decimales: los mismos que CompraItem.costo_unitario y Producto.precio_costo.
    costo_unitario = serializers.DecimalField(max_digits=14, decimal_places=4, min_value=Decimal("0"))


class CompraCreateSerializer(serializers.Serializer):
    """Input para registrar una compra (Fase 5). El total se recalcula en el
    servidor a partir de los ítems — nunca se confía en lo que mande el cliente."""

    proveedor = serializers.UUIDField(required=False, allow_null=True, default=None)
    numero_factura = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    fecha = serializers.DateField()
    # Compra fiada: cuándo hay que pagarla. Opcional — al contado no aplica.
    fecha_vencimiento = serializers.DateField(required=False, allow_null=True, default=None)
    pagado = serializers.BooleanField(default=False)
    # De qué contenedor sale la plata cuando se paga en el acto.
    cuenta_pago = serializers.UUIDField(required=False, allow_null=True, default=None)
    items = CompraItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("La compra necesita al menos un ítem.")
        return items


class CompraPagoInputSerializer(serializers.Serializer):
    """Un pago contra una compra fiada. `fecha` es la del pago real, que es la
    que cuenta como egreso (no la de llegada de la mercadería)."""

    fecha = serializers.DateField()
    monto = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    cuenta_pago = serializers.UUIDField(required=False, allow_null=True, default=None)
    notas = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")


class CompraPagoSerializer(serializers.ModelSerializer):
    cuenta_nombre = serializers.CharField(source="cuenta.nombre", read_only=True, default=None)

    class Meta:
        model = CompraPago
        fields = ["id", "fecha", "monto", "cuenta", "cuenta_nombre", "notas", "created_at"]


class CompraItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True, default=None)

    class Meta:
        model = CompraItem
        fields = ["id", "producto", "producto_nombre", "cantidad", "costo_unitario", "subtotal"]


class CompraSerializer(serializers.ModelSerializer):
    items = CompraItemSerializer(many=True, read_only=True)
    pagos = CompraPagoSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True, default=None)
    total_pagado = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    estado = serializers.SerializerMethodField()

    class Meta:
        model = Compra
        fields = [
            "id", "proveedor", "proveedor_nombre", "numero_factura", "fecha",
            "fecha_vencimiento", "total", "pagado", "estado", "total_pagado",
            "saldo_pendiente", "caja_sesion", "items", "pagos", "created_at",
        ]
        read_only_fields = ["id", "total", "caja_sesion", "created_at"]

    def get_estado(self, compra) -> str:
        # `pagado` manda por encima de la suma de pagos: las compras cargadas
        # antes de que existiera CompraPago están saldadas pero no tienen filas.
        if compra.pagado:
            return "pagada"
        return "parcial" if compra.total_pagado > 0 else "pendiente"
