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
    # Sólo lo manda el frontend al cobrar (ver PresupuestoCobrarModal): la
    # Venta ya se creó por la vía normal de siempre (POST /ventas/, con su
    # propia validación completa); esto sólo linkea el id para que el
    # presupuesto sepa en qué venta terminó.
    venta = serializers.UUIDField(required=False, allow_null=True, default=None)


class PresupuestoItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True, default=None)
    unidad_medida = serializers.CharField(source="producto.unidad_medida", read_only=True, default=None)
    bolsa_kg = serializers.DecimalField(
        source="producto.bolsa_kg", max_digits=14, decimal_places=3, read_only=True, default=None
    )
    # Precio ACTUAL del producto (no el congelado en precio_unitario/subtotal):
    # el frontend los necesita para reabrir el presupuesto en el editor de
    # ítems y recalcular el mismo precio que va a cobrar el servidor al
    # guardar — que siempre reprecia todo contra el Producto vigente, nunca
    # confía en lo guardado (ver PresupuestoViewSet._guardar).
    venta_por_peso = serializers.BooleanField(source="producto.venta_por_peso", read_only=True, default=False)
    precio_venta = serializers.DecimalField(
        source="producto.precio_venta", max_digits=14, decimal_places=2, read_only=True, default=None
    )
    precio_bolsa = serializers.DecimalField(
        source="producto.precio_bolsa", max_digits=14, decimal_places=2, read_only=True, default=None
    )
    precio_oferta = serializers.DecimalField(
        source="producto.precio_oferta", max_digits=14, decimal_places=2, read_only=True, default=None
    )
    oferta_activa = serializers.BooleanField(source="producto.oferta_activa", read_only=True, default=False)

    class Meta:
        model = PresupuestoItem
        fields = [
            "id", "producto", "producto_nombre", "unidad_medida", "bolsa_kg",
            "venta_por_peso", "precio_venta", "precio_bolsa", "precio_oferta", "oferta_activa",
            "cantidad", "es_bolsa", "precio_unitario", "subtotal",
        ]


class PresupuestoSerializer(serializers.ModelSerializer):
    items = PresupuestoItemSerializer(many=True, read_only=True)
    cliente_registrado_nombre = serializers.CharField(source="cliente.nombre", read_only=True, default=None)
    venta_numero_ticket = serializers.IntegerField(source="venta.numero_ticket", read_only=True, default=None)

    class Meta:
        model = Presupuesto
        fields = [
            "id", "cliente", "cliente_registrado_nombre", "cliente_nombre", "numero",
            "notas", "estado", "validez", "subtotal", "descuento", "total", "items", "created_at",
            "venta", "venta_numero_ticket",
        ]
