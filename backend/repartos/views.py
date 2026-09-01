from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from clientes.models import Cliente
from core.mixins import TenantViewSet, resolver_comercio_activo
from core.models import Perfil
from productos.models import Producto
from productos.precios import resolver_precio_item

from caja.models import CuentaPago
from ventas.models import Venta

from .models import Reparto, RepartoItem
from .serializers import (
    RepartoEstadoSerializer,
    RepartoSerializer,
    RepartoWriteSerializer,
)


class RepartoViewSet(TenantViewSet):
    """Pedidos a domicilio: productos + destino + costo de envío + descuento.

    Los precios salen del Producto con la misma regla que el POS (suelto vs
    bolsa cerrada), así el reparto no puede salir a otro precio que el
    mostrador. No mueve stock ni caja — ver docstring del modelo Reparto.
    """

    queryset = (
        Reparto.objects.all()
        .select_related("cliente", "repartidor")
        .prefetch_related("items__producto")
        .order_by("-fecha", "-created_at")
    )
    filterset_fields = ["estado", "cliente"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RepartoWriteSerializer
        if self.action == "estado":
            return RepartoEstadoSerializer
        return RepartoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        fecha_desde = self.request.query_params.get("fecha_desde")
        fecha_hasta = self.request.query_params.get("fecha_hasta")
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(cliente_nombre__icontains=search) | qs.filter(destino__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)
        reparto = self._guardar(comercio, serializer.validated_data, request=request)
        return Response(RepartoSerializer(reparto).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instancia = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=kwargs.pop("partial", False))
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)
        reparto = self._guardar(comercio, serializer.validated_data, instancia=instancia)
        return Response(RepartoSerializer(reparto).data)

    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        """Cambiar sólo el estado (pendiente → en camino → entregado), que es
        lo que se toca desde la lista sin reabrir todo el formulario."""
        reparto = self.get_object()
        comercio = resolver_comercio_activo(request)
        serializer = RepartoEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reparto.estado = serializer.validated_data["estado"]
        campos = ["estado", "updated_at"]

        venta_id = serializer.validated_data["venta"]
        if venta_id:
            if reparto.venta_id:
                raise ValidationError("Este reparto ya está facturado.")
            venta = Venta.objects.filter(comercio=comercio, id=venta_id).first()
            if venta is None:
                raise ValidationError({"venta": "No pertenece a este comercio."})
            reparto.venta = venta
            campos.append("venta")

        reparto.save(update_fields=campos)
        return Response(RepartoSerializer(reparto).data)

    def _guardar(self, comercio, data, instancia=None, request=None):
        with transaction.atomic():
            producto_ids = [item["producto"] for item in data["items"]]
            productos = {
                p.id: p for p in Producto.objects.filter(comercio=comercio, id__in=producto_ids)
            }

            cuenta_obj = None
            if data["cuenta_pago"]:
                cuenta_obj = CuentaPago.objects.filter(comercio=comercio, id=data["cuenta_pago"]).first()
                if cuenta_obj is None:
                    raise ValidationError({"cuenta_pago": "No pertenece a este comercio."})

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
                items_a_crear.append(RepartoItem(
                    producto=producto,
                    cantidad=cantidad,
                    es_bolsa=item["es_bolsa"],
                    precio_unitario=precio_unitario,
                    subtotal=item_subtotal,
                ))

            if data["descuento"] > subtotal:
                raise ValidationError({"descuento": "No puede ser mayor al subtotal de los productos."})

            total = max(subtotal - data["descuento"] + data["costo_envio"], Decimal("0"))

            campos = {
                "cliente": cliente_obj,
                "cliente_nombre": data["cliente_nombre"],
                "telefono": data["telefono"],
                "destino": data["destino"],
                "fecha": data["fecha"],
                "estado": data["estado"],
                "notas": data["notas"],
                "cuenta_pago": cuenta_obj,
                "a_cuenta_corriente": data["a_cuenta_corriente"],
                "subtotal": subtotal,
                "costo_envio": data["costo_envio"],
                "descuento": data["descuento"],
                "total": total,
            }

            if instancia is None:
                perfil = Perfil.objects.filter(user=request.user).first() if request else None
                reparto = Reparto.objects.create(comercio=comercio, repartidor=perfil, **campos)
            else:
                reparto = instancia
                for campo, valor in campos.items():
                    setattr(reparto, campo, valor)
                reparto.save()
                reparto.items.all().delete()

            for item in items_a_crear:
                item.reparto = reparto
            RepartoItem.objects.bulk_create(items_a_crear)

        return reparto
