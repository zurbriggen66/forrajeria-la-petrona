from decimal import Decimal

from django.db import transaction
from drf_spectacular.utils import extend_schema_field
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
            "venta_por_peso", "unidad_medida", "precio_bolsa", "bolsa_kg", "stock_en_bolsas",
            "precio_oferta", "oferta_activa",
            "modelo_nombre", "talle", "color", "imagen_url",
            "destacado", "activo", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "stock_bajo", "created_at", "updated_at"]

    def get_margen_pct(self, producto):
        if not producto.precio_venta:
            return None
        return round(float((producto.precio_venta - producto.precio_costo) / producto.precio_venta) * 100, 2)


class ComboItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    # Precio suelto, costo y stock del componente: sin esto el armador de packs
    # no puede decir cuánto costaría comprado por separado, ni cuántos packs
    # entran en el stock que hay. Al editar un pack ya guardado el formulario no
    # tiene los Producto completos, sólo lo que devuelve esto.
    producto_precio_venta = serializers.DecimalField(
        source="producto.precio_venta", max_digits=14, decimal_places=2, read_only=True,
    )
    producto_precio_costo = serializers.DecimalField(
        source="producto.precio_costo", max_digits=14, decimal_places=4, read_only=True,
    )
    producto_stock = serializers.DecimalField(
        source="producto.stock", max_digits=14, decimal_places=3, read_only=True,
    )
    producto_unidad_medida = serializers.CharField(source="producto.unidad_medida", read_only=True)

    class Meta:
        model = ComboItem
        fields = [
            "id", "producto", "producto_nombre", "cantidad",
            "producto_precio_venta", "producto_precio_costo", "producto_stock",
            "producto_unidad_medida",
        ]


class ComboSerializer(serializers.ModelSerializer):
    items = ComboItemSerializer(many=True)
    precio_suelto = serializers.SerializerMethodField()
    costo = serializers.SerializerMethodField()
    descuento_pct = serializers.SerializerMethodField()
    margen_pct = serializers.SerializerMethodField()
    armables = serializers.SerializerMethodField()

    class Meta:
        model = Combo
        fields = [
            "id", "nombre", "descripcion", "precio", "activo", "items",
            "precio_suelto", "costo", "descuento_pct", "margen_pct", "armables",
        ]

    # Los cinco de abajo se calculan en el servidor y no en el formulario porque
    # el listado de packs también los muestra, y ahí el front no tiene los
    # productos cargados. Todos leen combo.items ya prefetcheado con su producto
    # (ver ComboViewSet.queryset), así que no hay una consulta por ítem.

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=2))
    def get_precio_suelto(self, combo):
        """Lo que costaría comprar lo mismo suelto. Es contra esto que se mide
        si el pack es una oferta o no."""
        return sum(
            (item.producto.precio_venta * item.cantidad for item in combo.items.all()),
            Decimal("0"),
        ).quantize(Decimal("0.01"))

    @extend_schema_field(serializers.DecimalField(max_digits=14, decimal_places=2))
    def get_costo(self, combo):
        return sum(
            (item.producto.precio_costo * item.cantidad for item in combo.items.all()),
            Decimal("0"),
        ).quantize(Decimal("0.01"))

    @extend_schema_field(float)
    def get_descuento_pct(self, combo):
        """Cuánto se le regala al cliente contra comprarlo suelto. Negativo
        significa que el pack sale MÁS caro que suelto, que casi siempre es un
        error de carga y hay que poder verlo."""
        suelto = self.get_precio_suelto(combo)
        if suelto <= 0:
            return None
        return round(float((suelto - combo.precio) / suelto) * 100, 2)

    @extend_schema_field(float)
    def get_margen_pct(self, combo):
        """Margen sobre el precio del pack, misma convención que Producto."""
        if not combo.precio:
            return None
        return round(float((combo.precio - self.get_costo(combo)) / combo.precio) * 100, 2)

    @extend_schema_field(int)
    def get_armables(self, combo):
        """Cuántos packs enteros salen del stock que hay hoy. Manda el
        componente más escaso: con 8 balanceados no se arman dos packs de 10 por
        más que sobren huevos."""
        items = list(combo.items.all())
        if not items:
            return 0
        posibles = []
        for item in items:
            if item.cantidad <= 0:
                continue
            posibles.append(int(item.producto.stock // item.cantidad))
        return max(min(posibles), 0) if posibles else 0

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


class AjusteProductoSerializer(serializers.Serializer):
    """Un producto elegido a mano en la galería. `valor` es el ajuste propio de
    ese producto; ausente o null = va con el valor general."""

    producto = serializers.UUIDField()
    valor = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True, default=None,
    )


class AplicarAjustePrecioSerializer(serializers.Serializer):
    """Input para aplicar un aumento/descuento de precio_venta.

    Dos formas de elegir a qué productos:
      - `categoria` / `proveedor`: el filtro de siempre, le pega a todos los
        activos que coincidan.
      - `productos`: la selección explícita de la galería. Cuando viene, MANDA
        sobre el filtro — el dueño eligió uno por uno y no hay que adivinar.

    `valor` puede ser negativo: un descuento es un aumento al revés y no hace
    falta otro camino para eso.
    """

    descripcion = serializers.CharField(required=False, allow_blank=True, default="")
    tipo = serializers.ChoiceField(choices=["porcentaje", "monto"])
    valor = serializers.DecimalField(max_digits=14, decimal_places=2)
    categoria = serializers.CharField(required=False, allow_blank=True, default="")
    proveedor = serializers.UUIDField(required=False, allow_null=True, default=None)
    productos = AjusteProductoSerializer(many=True, required=False, default=list)

    def validate_productos(self, seleccion):
        vistos = set()
        for item in seleccion:
            if item["producto"] in vistos:
                raise serializers.ValidationError("Hay un producto repetido en la selección.")
            vistos.add(item["producto"])
        return seleccion
