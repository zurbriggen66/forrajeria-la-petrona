from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from clientes.models import Cliente
from core.mixins import TenantViewSet, resolver_comercio_activo
from productos.models import Producto
from productos.precios import resolver_precio_item

from .models import Presupuesto, PresupuestoItem, Venta
from .serializers_presupuestos import (
    PresupuestoEstadoSerializer,
    PresupuestoSerializer,
    PresupuestoWriteSerializer,
)


class PresupuestoViewSet(TenantViewSet):
    """Cotizaciones para clientes: productos + descuento, con los mismos
    precios que el mostrador (ver docstring del modelo Presupuesto)."""

    queryset = (
        Presupuesto.objects.all()
        .select_related("cliente")
        .prefetch_related("items__producto")
        .order_by("-created_at")
    )
    filterset_fields = ["estado", "cliente"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PresupuestoWriteSerializer
        if self.action == "estado":
            return PresupuestoEstadoSerializer
        return PresupuestoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(cliente_nombre__icontains=search) | qs.filter(numero__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)
        presupuesto = self._guardar(comercio, serializer.validated_data)
        return Response(PresupuestoSerializer(presupuesto).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instancia = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=kwargs.pop("partial", False))
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)
        presupuesto = self._guardar(comercio, serializer.validated_data, instancia=instancia)
        return Response(PresupuestoSerializer(presupuesto).data)

    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        """Cambiar sólo el estado (pendiente → aprobado/rechazado/vencido/
        cobrado), que es lo que se toca desde la lista sin reabrir todo el
        formulario.

        Al cobrar, el frontend ya creó la Venta por la vía de siempre
        (POST /ventas/, con toda su validación de stock/caja/cuenta
        corriente) y sólo manda el id acá para linkearla — este endpoint no
        cobra nada, sólo lleva la cuenta de en qué venta terminó."""
        presupuesto = self.get_object()
        serializer = PresupuestoEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)

        presupuesto.estado = serializer.validated_data["estado"]
        campos = ["estado", "updated_at"]

        venta_id = serializer.validated_data["venta"]
        if venta_id:
            venta = Venta.objects.filter(comercio=comercio, id=venta_id).first()
            if venta is None:
                raise ValidationError({"venta": "No pertenece a este comercio."})
            presupuesto.venta = venta
            campos.append("venta")

        presupuesto.save(update_fields=campos)
        return Response(PresupuestoSerializer(presupuesto).data)

    def _guardar(self, comercio, data, instancia=None):
        with transaction.atomic():
            producto_ids = [item["producto"] for item in data["items"]]
            productos = {
                p.id: p for p in Producto.objects.filter(comercio=comercio, id__in=producto_ids)
            }

            cliente_obj = None
            if data["cliente"]:
                cliente_obj = Cliente.objects.filter(comercio=comercio, id=data["cliente"]).first()
                if cliente_obj is None:
                    raise ValidationError({"cliente": "No pertenece a este comercio."})

            items_a_crear = []
            subtotal = Decimal("0")
            for item in data["items"]:
                producto = productos.get(item["producto"])
                if producto is None:
                    raise ValidationError({"items": f"Producto {item['producto']} no existe en este comercio."})

                cantidad = item["cantidad"]
                precio_unitario, _costo, _kg = resolver_precio_item(producto, cantidad, item["es_bolsa"])
                item_subtotal = (precio_unitario * cantidad).quantize(Decimal("0.01"))
                subtotal += item_subtotal
                items_a_crear.append(PresupuestoItem(
                    producto=producto,
                    cantidad=cantidad,
                    es_bolsa=item["es_bolsa"],
                    precio_unitario=precio_unitario,
                    subtotal=item_subtotal,
                ))

            if data["descuento"] > subtotal:
                raise ValidationError({"descuento": "No puede ser mayor al subtotal de los productos."})

            total = max(subtotal - data["descuento"], Decimal("0"))

            campos = {
                "cliente": cliente_obj,
                "cliente_nombre": data["cliente_nombre"],
                "numero": data["numero"],
                "notas": data["notas"],
                "estado": data["estado"],
                "validez": data["validez"],
                "subtotal": subtotal,
                "descuento": data["descuento"],
                "total": total,
            }

            if instancia is None:
                presupuesto = Presupuesto.objects.create(comercio=comercio, **campos)
            else:
                presupuesto = instancia
                for campo, valor in campos.items():
                    setattr(presupuesto, campo, valor)
                presupuesto.save()
                presupuesto.items.all().delete()

            for item in items_a_crear:
                item.presupuesto = presupuesto
            PresupuestoItem.objects.bulk_create(items_a_crear)

        return presupuesto
