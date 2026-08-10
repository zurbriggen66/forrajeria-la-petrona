from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from caja.models import CuentaPago
from clientes.models import Cliente
from core.mixins import TenantViewSet, resolver_comercio_activo
from core.models import Perfil
from kubobots.models import KubobotsCliente
from productos.models import Producto

from .models import Venta, VentaItem
from .serializers import VentaCreateSerializer, VentaSerializer


class VentaViewSet(TenantViewSet):
    """Registrar ventas desde el POS (Fase 2). Historial/filtros completos
    llegan en la Fase 4; acá alcanza con crear y poder recuperar el ticket."""

    queryset = Venta.objects.all().prefetch_related("items").order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return VentaCreateSerializer
        return VentaSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        comercio = resolver_comercio_activo(request)

        existente = Venta.objects.filter(comercio=comercio, sync_uuid=data["sync_uuid"]).first()
        if existente:
            return Response(VentaSerializer(existente).data, status=status.HTTP_200_OK)

        try:
            venta = self._crear_venta(request, comercio, data)
        except IntegrityError:
            # Doble envío casi simultáneo de la misma venta (cola offline reintentando):
            # la constraint única (comercio, sync_uuid) evita el duplicado a nivel DB.
            existente = Venta.objects.filter(comercio=comercio, sync_uuid=data["sync_uuid"]).first()
            if existente:
                return Response(VentaSerializer(existente).data, status=status.HTTP_200_OK)
            raise
        return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)

    def _crear_venta(self, request, comercio, data):
        with transaction.atomic():
            producto_ids = [item["producto"] for item in data["items"]]
            productos = {
                p.id: p
                for p in Producto.objects.select_for_update().filter(comercio=comercio, id__in=producto_ids)
            }

            cliente_obj = None
            if data["cliente"]:
                cliente_obj = Cliente.objects.filter(comercio=comercio, id=data["cliente"]).first()
                if cliente_obj is None:
                    raise ValidationError({"cliente": "No pertenece a este comercio."})

            cuenta_pago_obj = None
            if data["cuenta_pago"]:
                cuenta_pago_obj = CuentaPago.objects.filter(comercio=comercio, id=data["cuenta_pago"]).first()
                if cuenta_pago_obj is None:
                    raise ValidationError({"cuenta_pago": "No pertenece a este comercio."})

            items_a_crear = []
            productos_a_actualizar = []
            total = Decimal("0")

            for item in data["items"]:
                producto = productos.get(item["producto"])
                if producto is None:
                    raise ValidationError({"items": f"Producto {item['producto']} no existe en este comercio."})

                cantidad = item["cantidad"]
                if producto.stock < cantidad:
                    raise ValidationError({
                        "items": f'No hay stock suficiente de "{producto.nombre}" (disponible: {producto.stock}).'
                    })

                precio_unitario = (
                    producto.precio_oferta
                    if producto.oferta_activa and producto.precio_oferta
                    else producto.precio_venta
                )
                subtotal = (precio_unitario * cantidad).quantize(Decimal("0.01"))
                total += subtotal

                items_a_crear.append(VentaItem(
                    producto=producto,
                    cantidad=cantidad,
                    peso_kg=cantidad if producto.venta_por_peso else None,
                    precio_unitario=precio_unitario,
                    costo_unitario=producto.precio_costo,
                    subtotal=subtotal,
                ))

                producto.stock = producto.stock - cantidad
                productos_a_actualizar.append(producto)

            total = total - data["descuento"] + data["recargo_monto"]
            if total < 0:
                total = Decimal("0")

            vuelto = None
            if data["efectivo_recibido"] is not None:
                vuelto = max(data["efectivo_recibido"] - total, Decimal("0"))

            numero_ticket = (
                Venta.objects.filter(comercio=comercio).aggregate(m=Max("numero_ticket"))["m"] or 0
            ) + 1

            perfil = Perfil.objects.filter(user=request.user).first()

            venta = Venta.objects.create(
                comercio=comercio,
                sync_uuid=data["sync_uuid"],
                numero_ticket=numero_ticket,
                vendedor=perfil,
                cliente=cliente_obj,
                cuenta_pago=cuenta_pago_obj,
                total=total,
                descuento=data["descuento"],
                recargo_monto=data["recargo_monto"],
                metodo_pago=data["metodo_pago"],
                monto_efectivo=data["monto_efectivo"],
                monto_tarjeta=data["monto_tarjeta"],
                monto_transferencia=data["monto_transferencia"],
                efectivo_recibido=data["efectivo_recibido"],
                vuelto=vuelto,
                origen=data["origen"] or "pos",
            )
            for item in items_a_crear:
                item.venta = venta
            VentaItem.objects.bulk_create(items_a_crear)
            Producto.objects.bulk_update(productos_a_actualizar, ["stock"])

            if (
                cliente_obj
                and not cliente_obj.kubobots_fid_off
                and comercio.kubobots_clientes_enabled
                and comercio.kubobots_fid_tasa > 0
            ):
                puntos_ganados = (total * comercio.kubobots_fid_tasa).quantize(Decimal("0.01"))
                kb, _ = KubobotsCliente.objects.get_or_create(
                    comercio=comercio, cliente=cliente_obj, defaults={"puntos": 0, "puntos_historicos": 0}
                )
                kb.puntos += puntos_ganados
                kb.puntos_historicos += puntos_ganados
                kb.save(update_fields=["puntos", "puntos_historicos"])

        return venta
