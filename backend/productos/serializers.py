from django.db import transaction
from rest_framework import serializers

from .models import (
    AjustePrecio,
    CategoriaProducto,
    Combo,
    ComboItem,
    ListaPrecio,
    Producto,
    ProductoUniversal,
    SubcategoriaProducto,
)


class CategoriaProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaProducto
        fields = ["id", "nombre", "orden", "activa"]


class SubcategoriaProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubcategoriaProducto
        fields = ["id", "categoria", "nombre", "orden", "activa"]


class ProductoUniversalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductoUniversal
        fields = ["id", "codigo_barras", "nombre", "descripcion", "categoria", "marca", "verificado"]


class ProductoSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True, default=None)
    margen_pct = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            "id", "codigo_barras", "nombre", "descripcion", "categoria", "subcategoria",
            "proveedor", "proveedor_nombre", "precio_costo", "precio_venta", "margen_pct", "alicuota_iva",
            "stock", "stock_minimo", "stock_bajo",
            "venta_por_peso", "unidad_medida", "plu_balanza",
            "precio_oferta", "oferta_activa",
            "modelo_nombre", "talle", "color",
            "destacado", "activo", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "stock_bajo", "created_at", "updated_at"]

    def get_margen_pct(self, producto):
        if not producto.precio_venta:
            return None
        return round(float((producto.precio_venta - producto.precio_costo) / producto.precio_venta) * 100, 2)


class ComboItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = ComboItem
        fields = ["id", "producto", "producto_nombre", "cantidad"]


class ComboSerializer(serializers.ModelSerializer):
    items = ComboItemSerializer(many=True)

    class Meta:
        model = Combo
        fields = ["id", "nombre", "descripcion", "precio", "activo", "items"]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        comercio = validated_data["comercio"]
        with transaction.atomic():
            combo = Combo.objects.create(**validated_data)
            ComboItem.objects.bulk_create(
                ComboItem(combo=combo, **item) for item in items_data
            )
        return combo

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if items_data is not None:
                instance.items.all().delete()
                ComboItem.objects.bulk_create(
                    ComboItem(combo=instance, **item) for item in items_data
                )
        return instance


class ListaPrecioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListaPrecio
        fields = ["id", "nombre", "descripcion", "ajuste_pct", "activo"]


class AjustePrecioSerializer(serializers.ModelSerializer):
    class Meta:
        model = AjustePrecio
        fields = [
            "id", "descripcion", "tipo", "valor", "filtro",
            "aplicado_por", "cant_productos", "created_at",
        ]
        read_only_fields = ["id", "aplicado_por", "cant_productos", "created_at"]


class AplicarAjustePrecioSerializer(serializers.Serializer):
    """Input para aplicar un aumento/descuento masivo de precio_venta."""
    descripcion = serializers.CharField(required=False, allow_blank=True, default="")
    tipo = serializers.ChoiceField(choices=["porcentaje", "monto"])
    valor = serializers.DecimalField(max_digits=14, decimal_places=2)
    categoria = serializers.CharField(required=False, allow_blank=True, default="")
    proveedor = serializers.UUIDField(required=False, allow_null=True, default=None)
