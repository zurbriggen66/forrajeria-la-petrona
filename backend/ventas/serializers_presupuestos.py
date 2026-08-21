from decimal import Decimal

from rest_framework import serializers

from .models import Presupuesto, PresupuestoItem


class PresupuestoItemInputSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    es_bolsa = serializers.BooleanField(default=False)


class PresupuestoWriteSerializer(serializers.Serializer):
    """Input para crear/editar un presupuesto. Los precios y el total se
    resuelven en el servidor contra el Producto — misma regla que Repartos/POS."""

    cliente = serializers.UUIDField(required=False, allow_null=True, default=None)
    cliente_nombre = serializers.CharField(max_length=200)
    numero = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    notas = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    estado = serializers.ChoiceField(choices=[e[0] for e in Presupuesto.ESTADOS], default="pendiente")
    validez = serializers.DateField(required=False, allow_null=True, default=None)
    descuento = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), default=0)
    items = PresupuestoItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("El presupuesto necesita al menos un producto.")
        return items

    def validate_cliente_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError("Poné a nombre de quién va el presupuesto.")
        return value.strip()


class PresupuestoEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=[e[0] for e in Presupuesto.ESTADOS])


class PresupuestoItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True, default=None)
    unidad_medida = serializers.CharField(source="producto.unidad_medida", read_only=True, default=None)
    bolsa_kg = serializers.DecimalField(
        source="producto.bolsa_kg", max_digits=14, decimal_places=3, read_only=True, default=None
    )

    class Meta:
        model = PresupuestoItem
        fields = [
            "id", "producto", "producto_nombre", "unidad_medida", "bolsa_kg",
            "cantidad", "es_bolsa", "precio_unitario", "subtotal",
        ]


class PresupuestoSerializer(serializers.ModelSerializer):
    items = PresupuestoItemSerializer(many=True, read_only=True)
    cliente_registrado_nombre = serializers.CharField(source="cliente.nombre", read_only=True, default=None)

    class Meta:
        model = Presupuesto
        fields = [
            "id", "cliente", "cliente_registrado_nombre", "cliente_nombre", "numero",
            "notas", "estado", "validez", "subtotal", "descuento", "total", "items", "created_at",
        ]
