from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, F, Max, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response

from caja.models import CajaMovimiento, CajaSesion
from caja.views import resolver_cuenta_efectivo, resolver_cuenta_por_tipo
from core.mixins import TenantViewSet, resolver_comercio_activo
from core.models import Perfil
from ventas.models import Venta
from core.whatsapp import enviar_whatsapp, formatear_monto_ar

from .models import (
    MEDIOS_PAGO, Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead, MovimientoAuditoria,
)
from .serializers import (
    ClienteAsignacionSerializer,
    ClienteMovimientoCreateSerializer,
    ClienteMovimientoSerializer,
    ClienteSerializer,
    CrmLeadSerializer,
    MovimientoAuditoriaSerializer,
    MovimientoEditarSerializer,
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


def _caja_abierta(comercio):
    return CajaSesion.objects.filter(comercio=comercio, estado="abierta").first()


def asentar_pago_en_caja(movimiento, cliente):
    """Mete el pago del cliente en la caja del turno abierto.

    Cuando alguien viene a saldar la cuenta, esa plata entra al cajón. Antes no
    entraba a ningún lado: el saldo del cliente bajaba y el arqueo del turno
    quedaba corto por ese monto, todos los días.

    Sólo los PAGOS. Un cargo (fiado) y un ajuste no mueven plata física; si
    tocaran la caja, el arqueo cerraría mal.

    Sin caja abierta no falla: el pago se registra igual —mismo criterio que un
    gasto o un pago a proveedor— pero queda fuera del arqueo, y el movimiento lo
    deja ver con caja_sesion en null.
    """
    if movimiento.tipo != "pago" or movimiento.monto <= 0:
        return None

    sesion = _caja_abierta(cliente.comercio)
    cuenta = resolver_cuenta_por_tipo(cliente.comercio, movimiento.medio_pago)
    movimiento.caja_sesion = sesion
    movimiento.cuenta_pago = cuenta
    movimiento.save(update_fields=["caja_sesion", "cuenta_pago"])

    if sesion is None:
        return None
    return CajaMovimiento.objects.create(
        comercio=cliente.comercio, sesion=sesion, cuenta=cuenta, tipo="ingreso",
        concepto=f"Pago de cuenta corriente — {cliente.nombre}",
        monto=movimiento.monto,
    )


def revertir_pago_en_caja(movimiento, cliente, concepto):
    """Saca de la caja un pago que se corrige o se borra.

    Sólo si la sesión donde entró sigue abierta: un turno ya cerrado no se
    retoca, queda como se reportó. Mismo criterio que anular una venta.
    """
    if movimiento.tipo != "pago" or not movimiento.caja_sesion_id:
        return
    if movimiento.caja_sesion.estado != "abierta":
        return
    CajaMovimiento.objects.create(
        comercio=cliente.comercio, sesion=movimiento.caja_sesion,
        cuenta=movimiento.cuenta_pago or resolver_cuenta_efectivo(cliente.comercio),
        tipo="egreso", concepto=concepto, monto=movimiento.monto,
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
            asentar_pago_en_caja(movimiento, cliente)
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
        total de la venta.

        Pide motivo y deja rastro (MovimientoAuditoria), igual que anular una
        venta: esto le cambia el saldo a un cliente, y antes se podía hacer sin
        decir por qué y sin que quedara registro de quién lo tocó.
        """
        cliente = self.get_object()
        movimiento = get_object_or_404(ClienteMovimiento, pk=movimiento_id, cliente=cliente)
        if movimiento.tipo == "cargo":
            return Response(
                {"detail": "Los cargos de una venta se corrigen anulando la venta, no acá."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entrada = MovimientoEditarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        # Copia de cómo estaba, ANTES de tocar nada: es lo que va al rastro.
        antes = {
            "movimiento_id": movimiento.pk,
            "tipo": movimiento.tipo,
            "monto_anterior": movimiento.monto,
            "referencia_anterior": movimiento.referencia,
            "medio_pago_anterior": movimiento.medio_pago,
        }
        saldo_anterior = cliente.saldo_actual
        perfil = Perfil.objects.filter(user=request.user).first()

        with transaction.atomic():
            _ajustar_saldo(cliente, -_signo(movimiento.tipo) * movimiento.monto)

            if request.method == "DELETE":
                # La plata que había entrado al cajón sale con él.
                revertir_pago_en_caja(
                    movimiento, cliente, f"Anulación pago de cuenta corriente — {cliente.nombre}",
                )
                movimiento.delete()
                MovimientoAuditoria.objects.create(
                    comercio=cliente.comercio, cliente=cliente, cliente_nombre=cliente.nombre,
                    accion="eliminado", motivo=datos["motivo"],
                    saldo_anterior=saldo_anterior, saldo_nuevo=cliente.saldo_actual,
                    hecho_por=perfil, **antes,
                )
                return Response(status=status.HTTP_204_NO_CONTENT)

            monto = datos.get("monto", movimiento.monto)
            if movimiento.tipo == "pago" and monto <= 0:
                raise ValidationError({"monto": "El pago tiene que ser un monto positivo."})

            # En la caja se revierte el monto viejo y se asienta el nuevo, en
            # vez de calcular la diferencia: si además cambió el medio de pago,
            # la plata tiene que salir del contenedor viejo y entrar al nuevo.
            revertir_pago_en_caja(
                movimiento, cliente, f"Corrección pago de cuenta corriente — {cliente.nombre}",
            )

            movimiento.monto = monto
            movimiento.referencia = datos.get("referencia", movimiento.referencia)
            movimiento.medio_pago = datos.get("medio_pago", movimiento.medio_pago)
            movimiento.save(update_fields=["monto", "referencia", "medio_pago"])
            asentar_pago_en_caja(movimiento, cliente)
            _ajustar_saldo(cliente, _signo(movimiento.tipo) * movimiento.monto)

            MovimientoAuditoria.objects.create(
                comercio=cliente.comercio, cliente=cliente, cliente_nombre=cliente.nombre,
                accion="editado", motivo=datos["motivo"],
                monto_nuevo=movimiento.monto,
                referencia_nueva=movimiento.referencia,
                medio_pago_nuevo=movimiento.medio_pago,
                saldo_anterior=saldo_anterior, saldo_nuevo=cliente.saldo_actual,
                hecho_por=perfil, **antes,
            )

        return Response(ClienteMovimientoSerializer(movimiento).data)

    @action(detail=False, methods=["get"])
    def estadisticas(self, request):
        """Los números de la cartera de clientes.

        Todo sale de dos consultas agregadas y no de traer las ventas al Python:
        con unos miles de ventas, iterarlas acá era medio segundo por pantalla.

        Los "dormidos" son el número comercial que nadie mira: clientes que
        compraban y hace más de 60 días que no aparecen. Es a quién llamar.
        """
        comercio = resolver_comercio_activo(request)
        dias_dormido = int(request.query_params.get("dias_dormido") or 60)
        corte = timezone.now() - timedelta(days=dias_dormido)

        clientes = Cliente.objects.filter(comercio=comercio, activo=True)
        saldos = clientes.aggregate(
            total=Count("id"),
            deuda=Sum("saldo_actual", filter=Q(saldo_actual__gt=0)),
            a_favor=Sum("saldo_actual", filter=Q(saldo_actual__lt=0)),
            con_deuda=Count("id", filter=Q(saldo_actual__gt=0)),
            con_saldo_a_favor=Count("id", filter=Q(saldo_actual__lt=0)),
        )

        # Compras por cliente, sin contar las anuladas.
        ventas = (
            Venta.objects.filter(comercio=comercio, anulada=False, cliente__isnull=False)
            .values("cliente", "cliente__nombre")
            .annotate(
                total=Sum("total"),
                cantidad=Count("id"),
                ultima=Max("created_at"),
            )
        )

        def fila(v):
            return {
                "cliente": str(v["cliente"]),
                "nombre": v["cliente__nombre"],
                "total": str(v["total"] or 0),
                "cantidad": v["cantidad"],
                "ticket_promedio": str(round((v["total"] or 0) / v["cantidad"], 2)) if v["cantidad"] else "0",
                "ultima_compra": v["ultima"].date() if v["ultima"] else None,
            }

        por_total = sorted(ventas, key=lambda v: v["total"] or 0, reverse=True)
        dormidos = [v for v in ventas if v["ultima"] and v["ultima"] < corte]
        dormidos.sort(key=lambda v: v["total"] or 0, reverse=True)

        deudores = clientes.filter(saldo_actual__gt=0).order_by("-saldo_actual")[:10]
        facturado = sum((v["total"] or Decimal("0") for v in ventas), Decimal("0"))
        cantidad_ventas = sum(v["cantidad"] for v in ventas)

        return Response({
            "clientes": saldos["total"] or 0,
            "con_deuda": saldos["con_deuda"] or 0,
            "con_saldo_a_favor": saldos["con_saldo_a_favor"] or 0,
            "total_por_cobrar": str(saldos["deuda"] or 0),
            # Se devuelve en positivo: "a favor" ya dice el sentido, y un
            # negativo en la tarjeta se lee como un error.
            "total_a_favor": str(abs(saldos["a_favor"] or 0)),
            "clientes_que_compraron": len(ventas),
            "facturado_a_clientes": str(facturado),
            "ticket_promedio": str(round(facturado / cantidad_ventas, 2)) if cantidad_ventas else "0",
            "dias_dormido": dias_dormido,
            "top_compradores": [fila(v) for v in por_total[:10]],
            "dormidos": [fila(v) for v in dormidos[:10]],
            "mayores_deudores": [
                {"cliente": str(c.id), "nombre": c.nombre, "saldo": str(c.saldo_actual),
                 "limite_credito": str(c.limite_credito),
                 "paso_el_limite": c.limite_credito > 0 and c.saldo_actual > c.limite_credito}
                for c in deudores
            ],
        })

    @action(detail=False, methods=["get"])
    def auditoria(self, request):
        """El registro de ediciones y borrados en cuentas corrientes.

        Por defecto devuelve la última semana, que es la ventana con la que se
        trabaja; con `desde`/`hasta` se va más atrás. Nada se borra solo: para
        archivar lo viejo hay un comando aparte (clientes_auditoria_archivar).
        """
        comercio = resolver_comercio_activo(request)
        qs = (
            MovimientoAuditoria.objects.filter(comercio=comercio)
            .select_related("hecho_por")
            .order_by("-created_at")
        )
        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        if desde:
            qs = qs.filter(created_at__date__gte=desde)
        elif not hasta:
            qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=7))
        if hasta:
            qs = qs.filter(created_at__date__lte=hasta)
        if request.query_params.get("cliente"):
            qs = qs.filter(cliente_id=request.query_params["cliente"])

        pagina = self.paginate_queryset(qs)
        serializer = MovimientoAuditoriaSerializer(pagina if pagina is not None else qs, many=True)
        return self.get_paginated_response(serializer.data) if pagina is not None else Response(serializer.data)


class ClienteAsignacionViewSet(TenantViewSet):
    queryset = ClienteAsignacion.objects.all().order_by("-created_at")
    serializer_class = ClienteAsignacionSerializer
    filterset_fields = ["cliente", "vendedor", "activo"]


class CrmLeadViewSet(TenantViewSet):
    queryset = CrmLead.objects.all().order_by("-created_at")
    serializer_class = CrmLeadSerializer
    filterset_fields = ["estado"]
