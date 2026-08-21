from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from caja.models import CajaMovimiento, CajaSesion
from caja.views import resolver_cuenta_efectivo
from core.mixins import TenantViewSet, resolver_comercio_activo
from productos.models import Producto
from proveedores.models import Proveedor, ProveedorMovimiento
from proveedores.views import aplicar_movimiento_proveedor

from .models import Compra, CompraItem
from .serializers import CompraCreateSerializer, CompraSerializer


class CompraViewSet(TenantViewSet):
    """Registrar compras a proveedor (Fase 5): suma stock, deja el costo de
    compra como nuevo precio_costo del producto, y actualiza la cuenta
    corriente del proveedor (+ la caja, si se marca pagada al toque)."""

    queryset = (
        Compra.objects.all()
        .select_related("proveedor")
        .prefetch_related("items__producto")
        .order_by("-fecha", "-created_at")
    )
    filterset_fields = ["proveedor", "pagado"]

    def get_serializer_class(self):
        if self.action == "create":
            return CompraCreateSerializer
        return CompraSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        fecha_desde = self.request.query_params.get("fecha_desde")
        fecha_hasta = self.request.query_params.get("fecha_hasta")
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)
        compra = self._crear_compra(comercio, serializer.validated_data)
        return Response(CompraSerializer(compra).data, status=status.HTTP_201_CREATED)

    def _crear_compra(self, comercio, data):
        with transaction.atomic():
            producto_ids = [item["producto"] for item in data["items"]]
            productos = {
                p.id: p
                for p in Producto.objects.select_for_update().filter(comercio=comercio, id__in=producto_ids)
            }

            proveedor_obj = None
            if data["proveedor"]:
                proveedor_obj = Proveedor.objects.select_for_update().filter(
                    comercio=comercio, id=data["proveedor"]
                ).first()
                if proveedor_obj is None:
                    raise ValidationError({"proveedor": "No pertenece a este comercio."})

            items_a_crear = []
            productos_a_actualizar = []
            total = Decimal("0")

            for item in data["items"]:
                producto = productos.get(item["producto"])
                if producto is None:
                    raise ValidationError({"items": f"Producto {item['producto']} no existe en este comercio."})

                cantidad = item["cantidad"]
                costo_unitario = item["costo_unitario"]
                subtotal = (costo_unitario * cantidad).quantize(Decimal("0.01"))
                total += subtotal

                items_a_crear.append(CompraItem(
                    producto=producto, cantidad=cantidad, costo_unitario=costo_unitario, subtotal=subtotal,
                ))
                producto.stock = producto.stock + cantidad
                producto.precio_costo = costo_unitario
                productos_a_actualizar.append(producto)

            caja_sesion = None
            if data["pagado"]:
                caja_sesion = CajaSesion.objects.select_for_update().filter(
                    comercio=comercio, estado="abierta"
                ).first()

            compra = Compra.objects.create(
                comercio=comercio,
                proveedor=proveedor_obj,
                numero_factura=data["numero_factura"],
                fecha=data["fecha"],
                total=total,
                pagado=data["pagado"],
                caja_sesion=caja_sesion,
            )
            for item in items_a_crear:
                item.compra = compra
            CompraItem.objects.bulk_create(items_a_crear)
            Producto.objects.bulk_update(productos_a_actualizar, ["stock", "precio_costo"])

            if proveedor_obj is not None:
                referencia = f"Compra {data['numero_factura']}".strip() or "Compra"
                ProveedorMovimiento.objects.create(
                    comercio=comercio, proveedor=proveedor_obj, tipo="compra", monto=total, referencia=referencia,
                )
                aplicar_movimiento_proveedor(proveedor_obj, "compra", total)

                if data["pagado"]:
                    ProveedorMovimiento.objects.create(
                        comercio=comercio, proveedor=proveedor_obj, tipo="pago",
                        monto=total, referencia=f"Pago — {referencia}",
                    )
                    aplicar_movimiento_proveedor(proveedor_obj, "pago", total)

            if data["pagado"] and caja_sesion is not None:
                CajaMovimiento.objects.create(
                    comercio=comercio,
                    sesion=caja_sesion,
                    cuenta=resolver_cuenta_efectivo(comercio),
                    tipo="egreso",
                    concepto=f"Compra a {proveedor_obj.nombre}" if proveedor_obj else "Compra a proveedor",
                    monto=total,
                )

        return compra
