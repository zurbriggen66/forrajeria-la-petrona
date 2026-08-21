from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from caja.models import CajaMovimiento, CajaSesion, CuentaPago
from caja.views import resolver_cuenta_efectivo
from clientes.models import Cliente, ClienteMovimiento
from clientes.views import aplicar_movimiento_cliente
from core.mixins import TenantViewSet, resolver_comercio_activo
from core.models import Perfil
from fiscal.afip import ErrorFiscal, solicitar_cae
from fiscal.models import ComercioFiscalConfig, FiscalQueue
from kubobots.models import KubobotsCliente
from productos.models import Producto
from productos.precios import resolver_precio_item

from .models import Venta, VentaItem, VentaPago
from .serializers import VentaAnularSerializer, VentaCreateSerializer, VentaSerializer


class VentaViewSet(TenantViewSet):
    """Registrar ventas desde el POS (Fase 2) e historial/anulación (Fase 4)."""

    # select_related/prefetch: sin esto el historial hacía una consulta por
    # cada venta (cliente, vendedor, cuenta de pago) y otra por cada ítem para
    # traer el nombre del producto — 60 ventas salían ~450 consultas.
    queryset = (
        Venta.objects.all()
        .select_related("cliente", "vendedor", "cuenta_pago")
        .prefetch_related("items__producto", "pagos__cuenta_pago")
        .order_by("-created_at")
    )
    filterset_fields = ["vendedor", "cliente", "cuenta_pago", "metodo_pago", "anulada", "numero_ticket"]

    def get_serializer_class(self):
        if self.action == "create":
            return VentaCreateSerializer
        if self.action == "anular":
            return VentaAnularSerializer
        return VentaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        fecha_desde = self.request.query_params.get("fecha_desde")
        fecha_hasta = self.request.query_params.get("fecha_hasta")
        if fecha_desde:
            qs = qs.filter(created_at__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(created_at__date__lte=fecha_hasta)
        categoria = self.request.query_params.get("categoria")
        if categoria:
            qs = qs.filter(items__producto__categoria=categoria).distinct()
        proveedor = self.request.query_params.get("proveedor")
        if proveedor:
            qs = qs.filter(items__producto__proveedor_id=proveedor).distinct()
        return qs

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

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        comercio = resolver_comercio_activo(request)
        venta = Venta.objects.filter(comercio=comercio, pk=pk).select_related("caja_sesion", "cliente").first()
        if venta is None:
            raise ValidationError("La venta no existe.")
        if venta.anulada:
            raise ValidationError("La venta ya está anulada.")

        serializer = VentaAnularSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            productos_a_actualizar = []
            for item in venta.items.filter(producto__isnull=False).select_related("producto"):
                producto = Producto.objects.select_for_update().get(pk=item.producto_id)
                # `peso_kg` guarda los kg reales descontados (venta suelta o por bolsa);
                # para productos que no son por peso, cantidad ya está en su unidad.
                cantidad_a_restaurar = item.peso_kg if item.peso_kg is not None else item.cantidad
                producto.stock = producto.stock + cantidad_a_restaurar
                productos_a_actualizar.append(producto)
            Producto.objects.bulk_update(productos_a_actualizar, ["stock"])

            venta.anulada = True
            venta.motivo_anulacion = serializer.validated_data["motivo"]
            venta.fecha_anulacion = timezone.now()
            venta.save(update_fields=["anulada", "motivo_anulacion", "fecha_anulacion", "updated_at"])

            # Sólo se corrige el arqueo si la caja de esa venta sigue abierta:
            # una sesión ya cerrada no se retoca, queda como quedó reportada.
            # Se revierte sólo lo que realmente entró a la caja en su momento
            # (total menos lo que se cargó a cuenta corriente, si hubo).
            monto_caja = venta.total - venta.monto_cuenta_corriente
            if venta.caja_sesion_id and venta.caja_sesion.estado == "abierta" and monto_caja > 0:
                # Se devuelve a cada cuenta lo que había entrado por ella: si
                # la venta fue mixta y se revirtiera todo contra una sola,
                # esa quedaría en rojo y las otras infladas.
                pagos = [(p.cuenta_pago, p.monto) for p in venta.pagos.select_related("cuenta_pago")]
                if not pagos:
                    # Ventas anteriores al desglose por medio de pago.
                    pagos = [(venta.cuenta_pago or resolver_cuenta_efectivo(comercio), monto_caja)]
                CajaMovimiento.objects.bulk_create([
                    CajaMovimiento(
                        comercio=comercio,
                        sesion=venta.caja_sesion,
                        cuenta=cuenta or resolver_cuenta_efectivo(comercio),
                        tipo="egreso",
                        concepto=f"Anulación venta #{venta.numero_ticket}",
                        monto=monto,
                    )
                    for cuenta, monto in pagos
                ])

            # Ídem para lo que se había cargado a la cuenta corriente del
            # cliente: se revierte siempre, sin importar el estado de la caja.
            if venta.monto_cuenta_corriente > 0 and venta.cliente_id:
                ClienteMovimiento.objects.create(
                    comercio=comercio,
                    cliente=venta.cliente,
                    tipo="ajuste",
                    monto=-venta.monto_cuenta_corriente,
                    referencia=f"Anulación venta #{venta.numero_ticket}",
                )
                aplicar_movimiento_cliente(venta.cliente, "ajuste", -venta.monto_cuenta_corriente)

        return Response(VentaSerializer(venta).data)

    @action(detail=True, methods=["post"])
    def facturar(self, request, pk=None):
        """Pide el CAE a ARCA para esta venta (Fase 7). Deliberadamente separado
        de la creación de la venta: es una llamada de red a un tercero, no puede
        bloquear el cobro ni los locks de stock de _crear_venta. Se puede
        reintentar — FiscalQueue.status queda en "error" con el motivo si ARCA
        rechaza el comprobante o no se pudo conectar."""
        comercio = resolver_comercio_activo(request)
        venta = Venta.objects.filter(comercio=comercio, pk=pk).first()
        if venta is None:
            raise ValidationError("La venta no existe.")
        if venta.anulada:
            raise ValidationError("No se puede facturar una venta anulada.")
        if venta.facturado:
            raise ValidationError("Esta venta ya tiene CAE.")

        config = ComercioFiscalConfig.objects.filter(comercio=comercio, activo=True).order_by(
            "-es_principal"
        ).first()
        if config is None:
            raise ValidationError("Este comercio no tiene configuración fiscal cargada (CUIT/punto de venta).")

        cola, _ = FiscalQueue.objects.update_or_create(
            comercio=comercio, venta=venta,
            defaults={"status": "procesando", "error_msg": ""},
        )

        try:
            resultado = solicitar_cae(venta, config)
        except ErrorFiscal as exc:
            cola.status = "error"
            cola.error_msg = str(exc)
            cola.save(update_fields=["status", "error_msg", "updated_at"])
            raise ValidationError({"fiscal": str(exc)})

        with transaction.atomic():
            venta.facturado = True
            venta.cae = resultado["cae"]
            venta.cae_vencimiento = resultado["cae_vencimiento"]
            venta.numero_factura = str(resultado["numero"])
            venta.punto_venta_factura = str(resultado["punto_vta"])
            venta.tipo_factura = str(resultado["tipo_cbte"])
            venta.fecha_facturacion = timezone.now()
            venta.save(update_fields=[
                "facturado", "cae", "cae_vencimiento", "numero_factura",
                "punto_venta_factura", "tipo_factura", "fecha_facturacion", "updated_at",
            ])

            cola.status = "ok"
            cola.cae = resultado["cae"]
            cola.cae_vencimiento = resultado["cae_vencimiento"]
            cola.punto_venta = str(resultado["punto_vta"])
            cola.numero_factura = str(resultado["numero"])
            cola.tipo_comprobante = str(resultado["tipo_cbte"])
            cola.save(update_fields=[
                "status", "cae", "cae_vencimiento", "punto_venta",
                "numero_factura", "tipo_comprobante", "updated_at",
            ])

        return Response(VentaSerializer(venta).data)

    def _resolver_pagos(self, comercio, data, monto_caja, cuenta_pago_obj):
        """Devuelve [(CuentaPago, monto)] con el reparto del cobro.

        Con `pagos` en el input es un pago mixto y se valida que la suma dé
        exactamente lo que hay que cobrar (si no, la caja cerraría con
        diferencia). Sin `pagos`, se mantiene el comportamiento de siempre:
        todo a `cuenta_pago`, o a efectivo — es lo que sigue mandando la cola
        offline con ventas guardadas antes de esta versión.
        """
        if monto_caja <= 0:
            return []

        lineas = data.get("pagos") or []
        if not lineas:
            return [(cuenta_pago_obj or resolver_cuenta_efectivo(comercio), monto_caja)]

        cuentas_pedidas = {linea["cuenta_pago"] for linea in lineas if linea["cuenta_pago"]}
        cuentas = {
            c.id: c for c in CuentaPago.objects.filter(comercio=comercio, id__in=cuentas_pedidas)
        }

        pagos = []
        suma = Decimal("0")
        for linea in lineas:
            cuenta_id = linea["cuenta_pago"]
            if cuenta_id is None:
                cuenta = resolver_cuenta_efectivo(comercio)
            else:
                cuenta = cuentas.get(cuenta_id)
                if cuenta is None:
                    raise ValidationError({"pagos": "Una de las cuentas de pago no pertenece a este comercio."})
            pagos.append((cuenta, linea["monto"]))
            suma += linea["monto"]

        if suma != monto_caja:
            raise ValidationError({
                "pagos": (
                    f"Los pagos suman {suma} y hay que cobrar {monto_caja}. "
                    "Tienen que coincidir exactamente."
                )
            })
        return pagos

    @staticmethod
    def _total_por_tipo(pagos, tipo):
        """Compatibilidad: los campos monto_efectivo/tarjeta/transferencia se
        siguen completando a partir del tipo de cada cuenta usada."""
        return sum(
            (monto for cuenta, monto in pagos if cuenta and cuenta.tipo == tipo), Decimal("0")
        )

    @staticmethod
    def _describir_metodo(pagos, metodo_pedido):
        if len(pagos) > 1:
            return "mixto"
        if pagos and pagos[0][0]:
            return pagos[0][0].tipo or pagos[0][0].nombre
        return metodo_pedido

    def _crear_venta(self, request, comercio, data):
        with transaction.atomic():
            caja_sesion = CajaSesion.objects.select_for_update().filter(
                comercio=comercio, estado="abierta"
            ).first()
            if caja_sesion is None:
                raise ValidationError("No hay una caja abierta. Abrí la caja antes de vender.")

            producto_ids = [item["producto"] for item in data["items"]]
            productos = {
                p.id: p
                for p in Producto.objects.select_for_update().filter(comercio=comercio, id__in=producto_ids)
            }

            cliente_obj = None
            if data["cliente"]:
                # select_for_update: se va a leer y potencialmente actualizar
                # saldo_actual más abajo si la venta se carga a cuenta corriente.
                cliente_obj = Cliente.objects.select_for_update().filter(comercio=comercio, id=data["cliente"]).first()
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
                precio_unitario, costo_unitario, kg_reales = resolver_precio_item(
                    producto, cantidad, item.get("es_bolsa")
                )

                if producto.stock < kg_reales:
                    raise ValidationError({
                        "items": f'No hay stock suficiente de "{producto.nombre}" (disponible: {producto.stock}).'
                    })

                subtotal = (precio_unitario * cantidad).quantize(Decimal("0.01"))
                total += subtotal

                items_a_crear.append(VentaItem(
                    producto=producto,
                    cantidad=cantidad,
                    peso_kg=kg_reales if producto.venta_por_peso else None,
                    precio_unitario=precio_unitario,
                    costo_unitario=costo_unitario,
                    subtotal=subtotal,
                ))

                producto.stock = producto.stock - kg_reales
                productos_a_actualizar.append(producto)

            total = total - data["descuento"] + data["recargo_monto"]
            if total < 0:
                total = Decimal("0")

            monto_cuenta_corriente = data["monto_cuenta_corriente"]
            if monto_cuenta_corriente > 0:
                if cliente_obj is None:
                    raise ValidationError({"cliente": "Elegí un cliente para cargar la venta a su cuenta corriente."})
                if monto_cuenta_corriente > total:
                    raise ValidationError({"monto_cuenta_corriente": "No puede ser mayor al total de la venta."})
                saldo_resultante = cliente_obj.saldo_actual + monto_cuenta_corriente
                if saldo_resultante > cliente_obj.limite_credito:
                    disponible = cliente_obj.limite_credito - cliente_obj.saldo_actual
                    raise ValidationError({
                        "monto_cuenta_corriente": f"Supera el límite de crédito del cliente (disponible: {disponible})."
                    })

            # Reparto del cobro entre medios de pago. `monto_caja` es lo que
            # realmente entra hoy: el total menos lo que se fía.
            monto_caja = total - monto_cuenta_corriente
            pagos = self._resolver_pagos(comercio, data, monto_caja, cuenta_pago_obj)

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
                caja_sesion=caja_sesion,
                cuenta_pago=cuenta_pago_obj,
                total=total,
                descuento=data["descuento"],
                recargo_monto=data["recargo_monto"],
                metodo_pago=self._describir_metodo(pagos, data["metodo_pago"]),
                monto_efectivo=self._total_por_tipo(pagos, "efectivo"),
                monto_tarjeta=self._total_por_tipo(pagos, "tarjeta"),
                monto_transferencia=self._total_por_tipo(pagos, "transferencia"),
                monto_cuenta_corriente=monto_cuenta_corriente,
                efectivo_recibido=data["efectivo_recibido"],
                vuelto=vuelto,
                origen=data["origen"] or "pos",
            )
            for item in items_a_crear:
                item.venta = venta
            VentaItem.objects.bulk_create(items_a_crear)
            Producto.objects.bulk_update(productos_a_actualizar, ["stock"])

            # Un movimiento de caja por medio de pago: el arqueo por contenedor
            # se calcula sobre CajaMovimiento.cuenta, así que meter un pago
            # mixto en una sola cuenta descuadraría el cierre.
            VentaPago.objects.bulk_create([
                VentaPago(venta=venta, cuenta_pago=cuenta, monto=monto) for cuenta, monto in pagos
            ])
            CajaMovimiento.objects.bulk_create([
                CajaMovimiento(
                    comercio=comercio,
                    sesion=caja_sesion,
                    cuenta=cuenta,
                    tipo="ingreso",
                    concepto=f"Venta #{numero_ticket}",
                    monto=monto,
                )
                for cuenta, monto in pagos
            ])

            if monto_cuenta_corriente > 0:
                ClienteMovimiento.objects.create(
                    comercio=comercio,
                    cliente=cliente_obj,
                    tipo="cargo",
                    monto=monto_cuenta_corriente,
                    referencia=f"Venta #{numero_ticket}",
                )
                aplicar_movimiento_cliente(cliente_obj, "cargo", monto_cuenta_corriente, f"Venta #{numero_ticket}")

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
