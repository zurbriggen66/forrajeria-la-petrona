from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from caja.models import CajaMovimiento, CajaSesion, CuentaPago
from caja.views import resolver_cuenta_efectivo
from core.mixins import TenantViewSet, resolver_comercio_activo
from productos.models import Producto
from proveedores.models import Proveedor, ProveedorMovimiento
from proveedores.views import aplicar_movimiento_proveedor

from .models import Compra, CompraItem, CompraPago
from .serializers import (
    CompraCreateSerializer,
    CompraPagoInputSerializer,
    CompraPagoSerializer,
    CompraSerializer,
)


class CompraViewSet(TenantViewSet):
    """Registrar compras a proveedor (Fase 5): suma stock, deja el costo de
    compra como nuevo precio_costo del producto, y actualiza la cuenta
    corriente del proveedor (+ la caja, si se marca pagada al toque)."""

    queryset = (
        Compra.objects.all()
        .select_related("proveedor")
        .prefetch_related("items__producto", "pagos__cuenta")
        .order_by("-fecha", "-created_at")
    )
    filterset_fields = ["proveedor", "pagado"]

    def get_serializer_class(self):
        if self.action == "create":
            return CompraCreateSerializer
        if self.action == "pagar":
            return CompraPagoInputSerializer
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

    @action(detail=True, methods=["post"])
    def pagar(self, request, pk=None):
        """Registrar un pago (total o parcial) de una compra fiada.

        El egreso cuenta el día del pago, que es de lo que se trata todo esto:
        la mercadería entró el 23/08 pero la plata sale el 15/09.
        """
        compra = self.get_object()
        comercio = resolver_comercio_activo(request)
        serializer = CompraPagoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # select_for_update para que dos pagos simultáneos no puedan pasarse
            # juntos del saldo (cada uno leería el mismo saldo viejo).
            compra = Compra.objects.select_for_update().prefetch_related("pagos").get(pk=compra.pk)
            if compra.pagado:
                raise ValidationError("Esta compra ya está saldada.")

            saldo = compra.saldo_pendiente
            if data["monto"] > saldo:
                raise ValidationError({
                    "monto": f"El pago supera lo que falta pagar de esta compra (saldo: {saldo})."
                })

            cuenta = self._resolver_cuenta(comercio, data["cuenta_pago"])
            pago = self._registrar_pago(
                comercio, compra, fecha=data["fecha"], monto=data["monto"],
                cuenta=cuenta, notas=data["notas"],
            )

        compra.refresh_from_db()
        return Response(
            {"pago": CompraPagoSerializer(pago).data, "compra": CompraSerializer(compra).data},
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _resolver_cuenta(comercio, cuenta_id):
        if not cuenta_id:
            return resolver_cuenta_efectivo(comercio)
        cuenta = CuentaPago.objects.filter(comercio=comercio, id=cuenta_id).first()
        if cuenta is None:
            raise ValidationError({"cuenta_pago": "No pertenece a este comercio."})
        return cuenta

    @staticmethod
    def _registrar_pago(comercio, compra, fecha, monto, cuenta, notas=""):
        """Asienta un pago: la fila CompraPago (el egreso, con su fecha real),
        el movimiento en la cuenta corriente del proveedor y la salida de caja.

        Ojo: el CajaMovimiento va contra la sesión abierta AHORA, no contra la
        de `fecha` — la plata sale del cajón del turno en curso. Si se carga un
        pago con fecha pasada, las estadísticas lo cuentan en su día (por
        CompraPago.fecha) pero el arqueo lo ve hoy. Mismo criterio que Gasto.
        """
        caja_sesion = CajaSesion.objects.filter(comercio=comercio, estado="abierta").first()

        pago = CompraPago.objects.create(
            comercio=comercio, compra=compra, fecha=fecha, monto=monto,
            cuenta=cuenta, caja_sesion=caja_sesion, notas=notas,
        )

        etiqueta = f"Compra {compra.numero_factura}".strip() or "Compra"
        if compra.proveedor_id is not None:
            proveedor = Proveedor.objects.select_for_update().get(pk=compra.proveedor_id)
            ProveedorMovimiento.objects.create(
                comercio=comercio, proveedor=proveedor, tipo="pago",
                monto=monto, referencia=f"Pago — {etiqueta}",
            )
            aplicar_movimiento_proveedor(proveedor, "pago", monto)

        if caja_sesion is not None:
            nombre_prov = compra.proveedor.nombre if compra.proveedor_id else "proveedor"
            CajaMovimiento.objects.create(
                comercio=comercio, sesion=caja_sesion, cuenta=cuenta, tipo="egreso",
                concepto=f"Pago a {nombre_prov} — {etiqueta}", monto=monto,
            )

        # Se relee de la base a propósito: `compra.total_pagado` usa el prefetch
        # cargado ANTES de crear este pago y nunca vería el que acabamos de
        # asentar, así que la compra jamás quedaría saldada.
        total_pagado = compra.pagos.aggregate(t=Sum("monto"))["t"] or Decimal("0")
        if total_pagado >= compra.total:
            Compra.objects.filter(pk=compra.pk).update(pagado=True)

        return pago

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

            compra = Compra.objects.create(
                comercio=comercio,
                proveedor=proveedor_obj,
                numero_factura=data["numero_factura"],
                fecha=data["fecha"],
                fecha_vencimiento=data["fecha_vencimiento"],
                total=total,
                # Lo pone _registrar_pago si se paga en el acto.
                pagado=False,
            )
            for item in items_a_crear:
                item.compra = compra
            CompraItem.objects.bulk_create(items_a_crear)
            Producto.objects.bulk_update(productos_a_actualizar, ["stock", "precio_costo"])

            # La deuda con el proveedor nace siempre con la compra: la mercadería
            # ya entró. Que esté paga o no lo resuelven los pagos.
            if proveedor_obj is not None:
                referencia = f"Compra {data['numero_factura']}".strip() or "Compra"
                ProveedorMovimiento.objects.create(
                    comercio=comercio, proveedor=proveedor_obj, tipo="compra", monto=total, referencia=referencia,
                )
                aplicar_movimiento_proveedor(proveedor_obj, "compra", total)

            # Pagada al contado: mismo camino que un pago posterior, con fecha
            # de hoy. Así una compra al contado y una fiada ya cancelada quedan
            # registradas igual y los egresos salen de un solo lugar.
            if data["pagado"]:
                pago = self._registrar_pago(
                    comercio, compra, fecha=data["fecha"], monto=total,
                    cuenta=self._resolver_cuenta(comercio, data["cuenta_pago"]),
                )
                # Se replica la sesión en la compra: es lo que sigue
                # significando `Compra.caja_sesion` para las compras al contado.
                Compra.objects.filter(pk=compra.pk).update(caja_sesion=pago.caja_sesion)
                compra.refresh_from_db()

        return compra
