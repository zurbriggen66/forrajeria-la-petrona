from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSet
from core.whatsapp import enviar_whatsapp, formatear_monto_ar

from .models import MEDIOS_PAGO, Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead
from .serializers import (
    ClienteAsignacionSerializer,
    ClienteMovimientoCreateSerializer,
    ClienteMovimientoSerializer,
    ClienteSerializer,
    CrmLeadSerializer,
)


def _signo(tipo):
    return -1 if tipo == "pago" else 1


def _ajustar_saldo(cliente, delta):
    Cliente.objects.filter(pk=cliente.pk).update(saldo_actual=F("saldo_actual") + delta)
    cliente.refresh_from_db(fields=["saldo_actual"])


MEDIO_PAGO_LABELS = dict(MEDIOS_PAGO)


def _recibo_whatsapp(cliente, titulo, monto_label, monto, detalle, saldo_anterior, agradecimiento):
    """Arma el recibo que recibe el cliente por WhatsApp: mismo formato para
    fiado y pago (fecha/hora, monto, detalle, saldo antes/después con
    semáforo), solo cambian título/campos entre uno y otro."""
    ahora = timezone.localtime()
    saldo_actual = cliente.saldo_actual
    emoji_saldo, estado_saldo = ("🔴", "debe") if saldo_actual > 0 else ("🟢", "al día")
    return (
        f"{titulo}\n"
        f"{ahora.strftime('%d/%m/%Y %H:%M')}\n\n"
        f"👤 {cliente.nombre}\n\n"
        f"{monto_label}: ${formatear_monto_ar(monto)}\n"
        f"{detalle}\n\n"
        f"Saldo anterior: ${formatear_monto_ar(saldo_anterior)}\n"
        f"{emoji_saldo} Saldo: ${formatear_monto_ar(saldo_actual)} ({estado_saldo})\n\n"
        f"{cliente.comercio.nombre}\n\n"
        f"Por cualquier duda o consulta, comunicate con el local. {agradecimiento}"
    )


def aplicar_movimiento_cliente(cliente, tipo, monto, referencia="", medio_pago=""):
    """Actualiza el saldo de cuenta corriente del cliente (lo que le debe al
    comercio). `monto` es el valor absoluto del movimiento; el signo del
    efecto lo decide `tipo`: cargo/ajuste suman deuda, pago la resta.

    `cargo` (fiado) y `pago` le mandan un recibo por WhatsApp al cliente;
    `cargo` además le avisa al comercio (dueño). Único gancho para los tres
    callers que generan estos movimientos: alta manual acá y venta fiada en
    ventas/views.py."""
    saldo_anterior = cliente.saldo_actual
    _ajustar_saldo(cliente, _signo(tipo) * monto)

    if tipo == "cargo":
        motivo = referencia or "fiado"
        if cliente.celular:
            enviar_whatsapp(cliente.celular, _recibo_whatsapp(
                cliente, "🛒 Fiado registrado en cuenta",
                "💰 Monto fiado", monto, f"📝 Motivo: {motivo}",
                saldo_anterior, "¡Gracias por tu compra!",
            ))
        if cliente.comercio.telefono:
            fecha = timezone.localdate().strftime("%d/%m/%Y")
            enviar_whatsapp(
                cliente.comercio.telefono,
                f"Fiado a {cliente.nombre}: ${formatear_monto_ar(monto)} ({motivo}) el {fecha}. "
                f"Saldo total del cliente: ${formatear_monto_ar(cliente.saldo_actual)}.",
            )
    elif tipo == "pago" and cliente.celular:
        medio_label = MEDIO_PAGO_LABELS.get(medio_pago, "No especificado")
        enviar_whatsapp(cliente.celular, _recibo_whatsapp(
            cliente, "💵 Pago registrado en cuenta",
            "💰 Monto abonado", monto, f"🏧 Medio de pago: {medio_label}",
            saldo_anterior, "¡Gracias por tu pago!",
        ))


class ClienteViewSet(TenantViewSet):
    """Clientes con cuenta corriente, límite de crédito y asignación a
    vendedor (Fase 6)."""

    queryset = Cliente.objects.all().order_by("nombre")
    serializer_class = ClienteSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["activo", "tipo"]
    search_fields = ["nombre", "telefono", "celular", "cuit"]
    ordering_fields = ["nombre"]

    def get_queryset(self):
        """Filtro por deuda del lado del servidor.

        Antes se hacía en el navegador sobre la página ya traída, lo que con
        la lista paginada daría un resultado falso: "los que deben" mostraría
        sólo los deudores de la página actual, no los del comercio.
        """
        qs = super().get_queryset()
        deuda = self.request.query_params.get("deuda")
        if deuda == "deben":
            qs = qs.filter(saldo_actual__gt=0)
        elif deuda == "al_dia":
            qs = qs.filter(saldo_actual__lte=0)
        return qs

    @action(detail=True, methods=["get"])
    def movimientos(self, request, pk=None):
        cliente = self.get_object()
        movimientos = ClienteMovimiento.objects.filter(cliente=cliente).order_by("-created_at")
        return Response(ClienteMovimientoSerializer(movimientos, many=True).data)

    @action(detail=True, methods=["post"], url_path="movimientos/nuevo")
    def nuevo_movimiento(self, request, pk=None):
        cliente = self.get_object()
        serializer = ClienteMovimientoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            movimiento = ClienteMovimiento.objects.create(
                comercio=cliente.comercio,
                cliente=cliente,
                tipo=data["tipo"],
                monto=data["monto"],
                referencia=data["referencia"],
                medio_pago=data["medio_pago"],
            )
            aplicar_movimiento_cliente(cliente, data["tipo"], data["monto"], data["referencia"], data["medio_pago"])

        return Response(ClienteMovimientoSerializer(movimiento).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=["patch", "delete"],
        url_path=r"movimientos/(?P<movimiento_id>[0-9a-f-]{36})",
    )
    def editar_movimiento(self, request, pk=None, movimiento_id=None):
        """Corrige o borra un pago/ajuste ya cargado. Los cargos de ventas no
        se tocan acá: quedan atados a la Venta y se revierten anulándola
        (ver ventas/views.py::anular), si no el saldo se desincroniza del
        total de la venta."""
        cliente = self.get_object()
        movimiento = get_object_or_404(ClienteMovimiento, pk=movimiento_id, cliente=cliente)
        if movimiento.tipo == "cargo":
            return Response(
                {"detail": "Los cargos de una venta se corrigen anulando la venta, no acá."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            _ajustar_saldo(cliente, -_signo(movimiento.tipo) * movimiento.monto)

            if request.method == "DELETE":
                movimiento.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)

            monto = request.data.get("monto", movimiento.monto)
            try:
                monto = Decimal(str(monto))
            except InvalidOperation:
                return Response({"monto": "Monto inválido."}, status=status.HTTP_400_BAD_REQUEST)
            if movimiento.tipo == "pago" and monto <= 0:
                return Response({"monto": "El pago tiene que ser un monto positivo."}, status=status.HTTP_400_BAD_REQUEST)

            movimiento.monto = monto
            movimiento.referencia = request.data.get("referencia", movimiento.referencia)
            movimiento.medio_pago = request.data.get("medio_pago", movimiento.medio_pago)
            movimiento.save(update_fields=["monto", "referencia", "medio_pago"])
            _ajustar_saldo(cliente, _signo(movimiento.tipo) * movimiento.monto)

        return Response(ClienteMovimientoSerializer(movimiento).data)


class ClienteAsignacionViewSet(TenantViewSet):
    queryset = ClienteAsignacion.objects.all().order_by("-created_at")
    serializer_class = ClienteAsignacionSerializer
    filterset_fields = ["cliente", "vendedor", "activo"]


class CrmLeadViewSet(TenantViewSet):
    queryset = CrmLead.objects.all().order_by("-created_at")
    serializer_class = CrmLeadSerializer
    filterset_fields = ["estado"]
