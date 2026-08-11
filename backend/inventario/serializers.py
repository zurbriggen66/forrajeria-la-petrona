from decimal import Decimal

from rest_framework import serializers

from .models import Deposito, StockDeposito


class DepositoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deposito
        fields = ["id", "nombre", "direccion", "activo"]


class StockDepositoSerializer(serializers.ModelSerializer):
    deposito_nombre = serializers.CharField(source="deposito.nombre", read_only=True)
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = StockDeposito
        fields = ["id", "deposito", "deposito_nombre", "producto", "producto_nombre", "stock"]
        read_only_fields = fields


class TransferenciaStockSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    origen = serializers.CharField()  # "central" o el id de un Deposito
    destino = serializers.CharField()  # ídem

    def validate(self, data):
        if data["origen"] == data["destino"]:
            raise serializers.ValidationError("El origen y el destino no pueden ser el mismo.")
        return data


class InventarioResumenSerializer(serializers.Serializer):
    total_productos = serializers.IntegerField()
    valor_stock_costo = serializers.DecimalField(max_digits=16, decimal_places=2)
    valor_stock_venta = serializers.DecimalField(max_digits=16, decimal_places=2)
    stock_bajo_count = serializers.IntegerField()
    sin_stock_count = serializers.IntegerField()


class RankingRentabilidadItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    nombre = serializers.CharField()
    categoria = serializers.CharField()
    precio_costo = serializers.DecimalField(max_digits=14, decimal_places=2)
    precio_venta = serializers.DecimalField(max_digits=14, decimal_places=2)
    margen_pct = serializers.FloatField()
    stock = serializers.DecimalField(max_digits=14, decimal_places=3)
