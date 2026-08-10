from rest_framework import serializers


class ResumenSerializer(serializers.Serializer):
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    egresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()
    ticket_promedio = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class TopProductoSerializer(serializers.Serializer):
    producto = serializers.UUIDField(allow_null=True)
    nombre = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3)
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)


class TopVendedorSerializer(serializers.Serializer):
    vendedor = serializers.UUIDField(allow_null=True)
    nombre = serializers.CharField()
    cantidad_ventas = serializers.IntegerField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)


class RankingsSerializer(serializers.Serializer):
    top_productos = TopProductoSerializer(many=True)
    top_vendedores = TopVendedorSerializer(many=True)


class RentabilidadProductoSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    nombre = serializers.CharField()
    categoria = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3)
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    costo = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()


class RentabilidadCategoriaSerializer(serializers.Serializer):
    categoria = serializers.CharField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    costo = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()


class RentabilidadProveedorSerializer(serializers.Serializer):
    proveedor = serializers.UUIDField(allow_null=True)
    nombre = serializers.CharField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    costo = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()


class RentabilidadHoraSerializer(serializers.Serializer):
    hora = serializers.IntegerField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class PeriodoSerializer(serializers.Serializer):
    desde = serializers.DateField()
    hasta = serializers.DateField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class ComparativaSerializer(serializers.Serializer):
    periodo_actual = PeriodoSerializer()
    periodo_anterior = PeriodoSerializer()
    variacion_ingresos_pct = serializers.FloatField(allow_null=True)
    variacion_cantidad_pct = serializers.FloatField(allow_null=True)


class VerdadDelNegocioSerializer(serializers.Serializer):
    por_categoria = RentabilidadCategoriaSerializer(many=True)
    por_proveedor = RentabilidadProveedorSerializer(many=True)
    por_hora = RentabilidadHoraSerializer(many=True)
    comparativa = ComparativaSerializer()
