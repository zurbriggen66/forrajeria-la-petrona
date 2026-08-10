from rest_framework import serializers


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
