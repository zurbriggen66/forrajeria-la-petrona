from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import ModuloHabilitado

from core.mixins import TenantViewSet, resolver_comercio_activo
from core.models import Perfil

from .models import AjustePrecio, CategoriaProducto, Combo, ListaPrecio, Producto, ProductoUniversal, SubcategoriaProducto
from .serializers import (
    AjustePrecioSerializer,
    AplicarAjustePrecioSerializer,
    CategoriaProductoSerializer,
    ComboSerializer,
    ListaPrecioSerializer,
    ProductoSerializer,
    ProductoUniversalSerializer,
    SubcategoriaProductoSerializer,
)


class CategoriaProductoViewSet(TenantViewSet):
    queryset = CategoriaProducto.objects.all().order_by("orden", "nombre")
    serializer_class = CategoriaProductoSerializer
    filterset_fields = ["activa"]


class SubcategoriaProductoViewSet(TenantViewSet):
    queryset = SubcategoriaProducto.objects.all().order_by("orden", "nombre")
    serializer_class = SubcategoriaProductoSerializer
    filterset_fields = ["activa", "categoria"]


class ProductoUniversalViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo maestro GLOBAL (no filtra por comercio): lectura para autocompletar
    el alta de productos por código de barras."""

    queryset = ProductoUniversal.objects.filter(activo=True).order_by("nombre")
    serializer_class = ProductoUniversalSerializer
    permission_classes = [IsAuthenticated, ModuloHabilitado]
    filterset_fields = ["codigo_barras"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ["codigo_barras", "nombre"]


class ProductoViewSet(TenantViewSet):
    # select_related: el serializer expone `proveedor_nombre`, que sin esto
    # dispara una consulta por producto que tenga proveedor cargado.
    queryset = Producto.objects.select_related("proveedor").order_by("nombre")
    serializer_class = ProductoSerializer
    filterset_fields = ["activo", "categoria", "proveedor", "venta_por_peso"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "codigo_barras"]
    ordering_fields = ["nombre", "precio_venta", "stock", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        stock_status = self.request.query_params.get("stock_status")
        if stock_status == "bajo":
            qs = qs.filter(stock__gt=0, stock__lte=F("stock_minimo"))
        elif stock_status == "sin_stock":
            qs = qs.filter(stock__lte=0)
        return qs

    def destroy(self, request, *args, **kwargs):
        """Borrar de verdad un producto con ventas o combos ya cargados dejaría
        tickets viejos sin nombre de producto y combos con menos ítems de los
        que en realidad tienen — en ese caso lo desactivamos (mismo criterio
        que ya usa `activo` en todo el resto del sistema) en vez de borrarlo."""
        producto = self.get_object()
        tiene_historial = producto.ventaitem_set.exists() or producto.comboitem_set.exists()
        if tiene_historial:
            producto.activo = False
            producto.save(update_fields=["activo"])
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)


class ComboViewSet(TenantViewSet):
    # items__producto y no sólo items: el serializer lee el precio, el costo y
    # el stock del componente de cada ítem para calcular el precio suelto y
    # cuántos packs se pueden armar — sin esto era una consulta por componente.
    queryset = Combo.objects.all().prefetch_related("items__producto").order_by("nombre")
    serializer_class = ComboSerializer
    filterset_fields = ["activo"]


class ListaPrecioViewSet(TenantViewSet):
    queryset = ListaPrecio.objects.all().order_by("nombre")
    serializer_class = ListaPrecioSerializer
    filterset_fields = ["activo"]


class AjustePrecioViewSet(TenantViewSet):
    """Historial de aumentos masivos (GET) + aplicar uno nuevo (POST).

    Aplicar un ajuste actualiza precio_venta de todos los productos que
    matchean el filtro, en una transacción, y deja registro en el historial.
    """

    queryset = AjustePrecio.objects.all().order_by("-created_at")
    filterset_fields = ["tipo"]

    def get_serializer_class(self):
        if self.action == "create":
            return AplicarAjustePrecioSerializer
        return AjustePrecioSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        comercio = resolver_comercio_activo(request)
        seleccion = data.get("productos") or []

        if seleccion:
            # Selección explícita de la galería: manda sobre el filtro. No se
            # exige activo=True — si el dueño lo eligió a mano, lo eligió.
            ids = [item["producto"] for item in seleccion]
            productos = Producto.objects.filter(comercio=comercio, id__in=ids)
            # Un id que no aparece sería un producto de otro comercio o borrado:
            # avisar, no aplicar el aumento a menos productos de los elegidos y
            # dejar que el dueño crea que salió completo.
            encontrados = set(productos.values_list("id", flat=True))
            faltan = [str(i) for i in ids if i not in encontrados]
            if faltan:
                raise ValidationError({
                    "productos": f"{len(faltan)} de los productos elegidos no existen en este comercio.",
                })
            valores = {item["producto"]: item["valor"] for item in seleccion}
        else:
            productos = Producto.objects.filter(comercio=comercio, activo=True)
            if data.get("categoria"):
                productos = productos.filter(categoria=data["categoria"])
            if data.get("proveedor"):
                productos = productos.filter(proveedor_id=data["proveedor"])
            valores = {}

        with transaction.atomic():
            productos = list(productos.select_for_update())
            for producto in productos:
                # `is None` y no `or`: un ajuste individual de 0 (este producto
                # no se toca) es un valor válido y no puede caer al general.
                propio = valores.get(producto.id)
                valor = data["valor"] if propio is None else propio
                if data["tipo"] == "porcentaje":
                    nuevo_precio = producto.precio_venta * (1 + valor / 100)
                else:
                    nuevo_precio = producto.precio_venta + valor
                # Un descuento grande no puede dejar el precio en negativo.
                producto.precio_venta = max(round(nuevo_precio, 2), Decimal("0"))
            Producto.objects.bulk_update(productos, ["precio_venta"])

            perfil = Perfil.objects.filter(user=request.user).first()
            ajuste = AjustePrecio.objects.create(
                comercio=comercio,
                descripcion=data.get("descripcion") or "",
                tipo=data["tipo"],
                valor=data["valor"],
                filtro={
                    "categoria": data.get("categoria") or None,
                    "proveedor": str(data["proveedor"]) if data.get("proveedor") else None,
                    # Rastro de la selección manual: sin esto el historial diría
                    # "10% en Alimento Balanceado" cuando en realidad se eligieron
                    # 12 de 40 productos, algunos con su propio porcentaje.
                    "productos": [str(i) for i in valores] or None,
                    "valores_individuales": {
                        str(i): str(v) for i, v in valores.items() if v is not None
                    } or None,
                },
                aplicado_por=perfil,
                cant_productos=len(productos),
            )

        output = AjustePrecioSerializer(ajuste)
        return Response(output.data, status=status.HTTP_201_CREATED)
