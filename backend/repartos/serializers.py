from decimal import Decimal

from rest_framework import serializers

from .models import Reparto, RepartoItem


class RepartoItemInputSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    es_bolsa = serializers.BooleanField(default=False)


class RepartoWriteSerializer(serializers.Serializer):
    """Input para crear/editar un reparto. Los precios y el total se resuelven
    en el servidor contra el Producto — nunca se confía en lo que manda el
    cliente (misma regla que el POS)."""

    cliente = serializers.UUIDField(required=False, allow_null=True, default=None)
    cliente_nombre = serializers.CharField(max_length=200)
    telefono = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    destino = serializers.CharField(max_length=300)
    fecha = serializers.DateField()
    estado = serializers.ChoiceField(choices=[e[0] for e in Reparto.ESTADOS], default="pendiente")
    notas = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    costo_envio = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), default=0)
    descuento = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"), default=0)
    cuenta_pago = serializers.UUIDField(required=False, allow_null=True, default=None)
    a_cuenta_corriente = serializers.BooleanField(default=False)
    items = RepartoItemInputSerializer(many=True)

    def validate(self, data):
        if data.get("a_cuenta_corriente"):
            if data.get("cuenta_pago"):
                raise serializers.ValidationError(
                    "Elegí una cosa o la otra: o se cobra con un medio de pago, o va a la cuenta corriente."
                )
            if not data.get("cliente"):
                raise serializers.ValidationError({
                    "cliente": "Para mandarlo a cuenta corriente elegí un cliente de la lista, "
                               "no alcanza con escribir el nombre.",
                })
        return data

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("El reparto necesita al menos un producto.")
        return items

    def validate_cliente_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError("Poné a nombre de quién va el reparto.")
        return value.strip()

    def validate_destino(self, value):
        if not value.strip():
            raise serializers.ValidationError("El reparto necesita una dirección de destino.")
        return value.strip()


class RepartoEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=[e[0] for e in Reparto.ESTADOS])
    # Sólo lo manda el frontend al facturar (ver RepartoCobrarModal): la Venta
    # ya se creó por la vía normal (POST /ventas/, con su validación de stock,
    # caja y cuenta corriente); esto sólo linkea el id.
    venta = serializers.UUIDField(required=False, allow_null=True, default=None)


class RepartoItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True, default=None)
    unidad_medida = serializers.CharField(source="producto.unidad_medida", read_only=True, default=None)
    bolsa_kg = serializers.DecimalField(
        source="producto.bolsa_kg", max_digits=14, decimal_places=3, read_only=True, default=None
    )
    # Los dos precios vigentes del producto: sin ellos el formulario de edición
    # no puede mostrar cuánto sale la línea si se cambia la cantidad o se pasa
    # de suelto a bolsa. `precio_unitario` es el congelado al cargar el reparto,
    # que no sirve para eso.
    producto_precio_venta = serializers.DecimalField(
        source="producto.precio_venta", max_digits=14, decimal_places=2, read_only=True, default=None
    )
    producto_precio_bolsa = serializers.DecimalField(
        source="producto.precio_bolsa", max_digits=14, decimal_places=2, read_only=True, default=None
    )

    class Meta:
        model = RepartoItem
        fields = [
            "id", "producto", "producto_nombre", "unidad_medida", "bolsa_kg",
            "cantidad", "es_bolsa", "precio_unitario", "subtotal",
            "producto_precio_venta", "producto_precio_bolsa",
        ]


class RepartoSerializer(serializers.ModelSerializer):
    items = RepartoItemSerializer(many=True, read_only=True)
    cliente_registrado_nombre = serializers.CharField(source="cliente.nombre", read_only=True, default=None)
    repartidor_nombre = serializers.CharField(source="repartidor.nombre_completo", read_only=True, default=None)
    cuenta_pago_nombre = serializers.CharField(source="cuenta_pago.nombre", read_only=True, default=None)
    venta_numero_ticket = serializers.IntegerField(source="venta.numero_ticket", read_only=True, default=None)

    class Meta:
        model = Reparto
        fields = [
            "id", "cliente", "cliente_registrado_nombre", "cliente_nombre", "telefono",
            "destino", "fecha", "estado", "repartidor", "repartidor_nombre", "notas",
            "subtotal", "costo_envio", "descuento", "total", "items", "created_at",
            "cuenta_pago", "cuenta_pago_nombre", "a_cuenta_corriente",
            "venta", "venta_numero_ticket",
        ]
