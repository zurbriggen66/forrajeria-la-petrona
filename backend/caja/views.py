import uuid
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.response import Response

from core.mixins import TenantViewSet, resolver_comercio_activo
from core.models import Perfil

from .models import CajaConteo, CajaMovimiento, CajaSesion, CuentaPago
from ventas.models import Venta
from .serializers import (
    CajaAperturaSerializer,
    CajaCierreSerializer,
    CajaContenedorSerializer,
    CajaMovimientoCreateSerializer,
    CajaMovimientoSerializer,
    CajaSesionSerializer,
    CajaTransferenciaSerializer,
    CuentaPagoSerializer,
)


class CuentaPagoViewSet(TenantViewSet):
    """Medios de cobro / contenedores de dinero (efectivo, tarjeta, MP, transferencia)."""

    queryset = CuentaPago.objects.all().order_by("nombre")
    serializer_class = CuentaPagoSerializer
    filterset_fields = ["activo"]


# Los movimientos de caja de una venta se identifican por su concepto, que arma
# ventas/views.py. Es un acoplamiento por texto: si allá cambia el formato, acá
# hay que cambiarlo igual.
# ponytail: alcanzaría con una FK a Venta en CajaMovimiento, pero es una tabla de
# plata en producción — migrar eso merece su propio cambio, no ir de garrón acá.
PREFIJO_VENTA = "Venta #"
PREFIJO_ANULACION = "Anulación venta #"


def obtener_sesion_abierta(comercio):
    return CajaSesion.objects.filter(comercio=comercio, estado="abierta").first()


def resolver_cuenta_efectivo(comercio):
    """La caja física siempre tiene un contenedor "Efectivo": si el comercio
    todavía no cargó sus cuentas de pago (Fase 1), lo crea la primera vez."""
    cuenta = CuentaPago.objects.filter(comercio=comercio, tipo="efectivo").order_by("created_at").first()
    if cuenta is None:
        cuenta, _ = CuentaPago.objects.get_or_create(
            comercio=comercio, nombre="Efectivo", defaults={"tipo": "efectivo"},
        )
    return cuenta


def resolver_cuenta_por_tipo(comercio, tipo):
    """La cuenta de pago del comercio para un tipo (efectivo, transferencia,
    tarjeta). Si el comercio no cargó una de ese tipo, cae en Efectivo: mejor
    que la plata entre a la caja en el contenedor equivocado a que no entre.
    """
    if tipo:
        cuenta = (
            CuentaPago.objects.filter(comercio=comercio, tipo=tipo, activo=True)
            .order_by("created_at")
            .first()
        )
        if cuenta is not None:
            return cuenta
    return resolver_cuenta_efectivo(comercio)


def calcular_contenedores(comercio, sesion, cuenta_efectivo=None):
    """Saldo por contenedor (cuenta de pago) acumulado durante la sesión actual.
    El monto de apertura se asigna íntegro al contenedor Efectivo: la caja se
    abre con un fondo fijo en billetes, no en cuentas bancarias.

    `cuenta_efectivo` se puede pasar ya resuelta para no repetir la consulta
    cuando quien llama también la necesita."""
    if cuenta_efectivo is None:
        cuenta_efectivo = resolver_cuenta_efectivo(comercio)
    movimientos_por_cuenta = (
        CajaMovimiento.objects.filter(sesion=sesion)
        .values("cuenta")
        .annotate(
            ingresos=Sum("monto", filter=Q(tipo="ingreso")),
            egresos=Sum("monto", filter=Q(tipo="egreso")),
        )
    )
    saldos = {
        fila["cuenta"]: (fila["ingresos"] or Decimal("0")) - (fila["egresos"] or Decimal("0"))
        for fila in movimientos_por_cuenta
    }

    # Se listan las cuentas activas y, además, cualquiera que tenga movimientos
    # en el turno: si se desactivó una cuenta a mitad del turno su plata sigue
    # existiendo y tiene que entrar al arqueo igual.
    cuentas = CuentaPago.objects.filter(comercio=comercio).filter(
        Q(activo=True) | Q(id__in=[c for c in saldos if c])
    ).order_by("nombre")

    contenedores = []
    for cuenta in cuentas:
        apertura = sesion.monto_apertura if cuenta.id == cuenta_efectivo.id else Decimal("0")
        contenedores.append({
            "cuenta": cuenta.id,
            "nombre": cuenta.nombre,
            "tipo": cuenta.tipo,
            "saldo_turno": apertura + saldos.get(cuenta.id, Decimal("0")),
        })
    return contenedores


class CajaSesionViewSet(TenantViewSet):
    """Apertura, cierre y arqueo de caja (Fase 3). Una caja lógica por comercio:
    no puede haber dos sesiones abiertas a la vez (constraint en el modelo)."""

    queryset = (
        CajaSesion.objects.select_related("cajero")
        .prefetch_related("conteos__cuenta")
        .order_by("-fecha_apertura")
    )
    serializer_class = CajaSesionSerializer
    http_method_names = ["get", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST", detail="Usá /caja/sesiones/abrir/ para abrir una caja.")

    @action(detail=False, methods=["get"])
    def actual(self, request):
        comercio = resolver_comercio_activo(request)
        sesion = obtener_sesion_abierta(comercio)
        if sesion is None:
            # OJO: Response(None) con el JSONRenderer de DRF devuelve un body
            # vacío (pensado para 204), no el literal `null` — así que en el
            # cliente no llega como `null` sino como string vacío. JsonResponse
            # sí serializa None a `null`, que es lo que necesita el frontend.
            return JsonResponse(None, safe=False)

        cuenta_efectivo = resolver_cuenta_efectivo(comercio)

        # Una venta anulada genera un par de movimientos que se cancelan entre sí
        # (el ingreso original de la venta + el egreso compensatorio de anular.py
        # en ventas/views.py): ninguno de los dos es información real de "cuánto
        # se vendió" ni "cuánto se retiró" en el turno, así que ambos KPIs los
        # excluyen — el saldo del contenedor (calcular_contenedores) no se toca,
        # ahí sí importa que sigan sumando/restando para cerrar en el número correcto.
        #
        # Las anulaciones se leen de los movimientos de ESTA sesión y no de todas
        # las ventas anuladas del comercio. Antes se traían los tickets anulados
        # de toda la historia en cada request (y este endpoint lo consulta la
        # barra de estado cada 30 s), así que el costo crecía para siempre.
        # Además es más correcto: una venta de este turno anulada la semana que
        # viene no debe reescribir hacia atrás lo que este turno facturó — su
        # egreso compensatorio cae en el turno en que se anuló.
        anulaciones = CajaMovimiento.objects.filter(
            sesion=sesion, concepto__startswith=PREFIJO_ANULACION,
        ).values_list("concepto", flat=True)
        conceptos_anulados = [c.replace(PREFIJO_ANULACION, PREFIJO_VENTA, 1) for c in anulaciones]
        ventas_efectivo = CajaMovimiento.objects.filter(
            sesion=sesion, tipo="ingreso", cuenta=cuenta_efectivo,
        ).exclude(concepto__in=conceptos_anulados).aggregate(total=Sum("monto"))["total"] or Decimal("0")
        retiros = CajaMovimiento.objects.filter(
            sesion=sesion, tipo="egreso", cuenta=cuenta_efectivo, transferencia_id__isnull=True,
        ).exclude(
            concepto__startswith=PREFIJO_ANULACION,
        ).aggregate(total=Sum("monto"))["total"] or Decimal("0")

        data = CajaSesionSerializer(sesion).data
        data["ventas_efectivo"] = ventas_efectivo
        data["retiros"] = retiros
        data["contenedores"] = CajaContenedorSerializer(
            calcular_contenedores(comercio, sesion, cuenta_efectivo), many=True,
        ).data
        return Response(data)

    @action(detail=False, methods=["post"])
    def abrir(self, request):
        comercio = resolver_comercio_activo(request)
        if obtener_sesion_abierta(comercio) is not None:
            raise ValidationError("Ya hay una caja abierta para este comercio.")

        serializer = CajaAperturaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        perfil = Perfil.objects.filter(user=request.user).first()
        try:
            sesion = CajaSesion.objects.create(
                comercio=comercio,
                cajero=perfil,
                estado="abierta",
                monto_apertura=serializer.validated_data["monto_apertura"],
            )
        except IntegrityError:
            raise ValidationError("Ya hay una caja abierta para este comercio.")
        return Response(CajaSesionSerializer(sesion).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        comercio = resolver_comercio_activo(request)
        sesion = CajaSesion.objects.filter(comercio=comercio, pk=pk).first()
        if sesion is None:
            raise ValidationError("La sesión de caja no existe.")
        if sesion.estado != "abierta":
            raise ValidationError("La caja ya está cerrada.")

        serializer = CajaCierreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            # Bloqueada mientras se arquea: dos cierres simultáneos calcularían
            # los dos sobre los mismos movimientos y el último pisaría al otro.
            sesion = CajaSesion.objects.select_for_update().get(pk=sesion.pk)
            if sesion.estado != "abierta":
                raise ValidationError("La caja ya está cerrada.")

            cuenta_efectivo = resolver_cuenta_efectivo(comercio)
            esperado_por_cuenta = {
                c["cuenta"]: c["saldo_turno"]
                for c in calcular_contenedores(comercio, sesion, cuenta_efectivo)
            }

            conteos = serializer.validated_data.get("conteos")
            if not conteos:
                # Cliente viejo: mandó un solo número. Es el efectivo, que es lo
                # único que se cuenta a mano.
                conteos = [{
                    "cuenta": cuenta_efectivo.id,
                    "contado": serializer.validated_data["monto_cierre"],
                }]

            contado_por_cuenta = {c["cuenta"]: c["contado"] for c in conteos}
            ajenas = set(contado_por_cuenta) - set(esperado_por_cuenta)
            if ajenas:
                raise ValidationError({"conteos": "Hay contenedores que no son de este comercio."})

            filas = [
                CajaConteo(
                    comercio=comercio, sesion=sesion, cuenta_id=cuenta_id, esperado=esperado,
                    # Un contenedor que no se contó se da por bueno: la plata que
                    # entró por transferencia está en el banco, no hay nada que
                    # contar y forzar un 0 inventaría un faltante.
                    contado=contado_por_cuenta.get(cuenta_id, esperado),
                )
                for cuenta_id, esperado in esperado_por_cuenta.items()
            ]
            CajaConteo.objects.bulk_create(filas)

            sesion.estado = "cerrada"
            sesion.monto_esperado = sum((f.esperado for f in filas), Decimal("0"))
            sesion.monto_cierre = sum((f.contado for f in filas), Decimal("0"))
            sesion.diferencia = sesion.monto_cierre - sesion.monto_esperado
            sesion.fecha_cierre = timezone.now()
            sesion.save(update_fields=[
                "estado", "monto_cierre", "monto_esperado", "diferencia", "fecha_cierre", "updated_at",
            ])

        return Response(CajaSesionSerializer(sesion).data)


class CajaMovimientoViewSet(TenantViewSet):
    """Ingresos/egresos/transferencias de la caja abierta (las ventas y los
    gastos generan sus propios movimientos automáticamente)."""

    # select_related: el serializer expone cuenta_nombre, así que sin esto el
    # listado hacía una consulta por cada movimiento.
    queryset = CajaMovimiento.objects.select_related("cuenta").order_by("-created_at")
    filterset_fields = ["sesion", "tipo", "cuenta"]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return CajaMovimientoCreateSerializer
        if self.action == "transferir":
            return CajaTransferenciaSerializer
        return CajaMovimientoSerializer

    def _resolver_cuenta(self, comercio, cuenta_id):
        if cuenta_id is None:
            return resolver_cuenta_efectivo(comercio)
        cuenta = CuentaPago.objects.filter(comercio=comercio, id=cuenta_id).first()
        if cuenta is None:
            raise ValidationError({"cuenta": "No pertenece a este comercio."})
        return cuenta

    def create(self, request, *args, **kwargs):
        comercio = resolver_comercio_activo(request)
        sesion = obtener_sesion_abierta(comercio)
        if sesion is None:
            raise ValidationError("No hay una caja abierta para registrar movimientos.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cuenta = self._resolver_cuenta(comercio, serializer.validated_data["cuenta"])

        movimiento = CajaMovimiento.objects.create(
            comercio=comercio,
            sesion=sesion,
            cuenta=cuenta,
            tipo=serializer.validated_data["tipo"],
            concepto=serializer.validated_data["concepto"],
            monto=serializer.validated_data["monto"],
        )
        return Response(CajaMovimientoSerializer(movimiento).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def transferir(self, request):
        comercio = resolver_comercio_activo(request)
        sesion = obtener_sesion_abierta(comercio)
        if sesion is None:
            raise ValidationError("No hay una caja abierta para transferir dinero.")

        serializer = CajaTransferenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cuenta_origen = CuentaPago.objects.filter(comercio=comercio, id=data["cuenta_origen"]).first()
        cuenta_destino = CuentaPago.objects.filter(comercio=comercio, id=data["cuenta_destino"]).first()
        if cuenta_origen is None or cuenta_destino is None:
            raise ValidationError("Las cuentas de la transferencia deben pertenecer a este comercio.")

        transferencia_id = uuid.uuid4()
        concepto = data["concepto"] or f"Transferencia {cuenta_origen.nombre} → {cuenta_destino.nombre}"

        with transaction.atomic():
            CajaMovimiento.objects.create(
                comercio=comercio, sesion=sesion, cuenta=cuenta_origen, tipo="egreso",
                concepto=concepto, monto=data["monto"], transferencia_id=transferencia_id,
            )
            ingreso = CajaMovimiento.objects.create(
                comercio=comercio, sesion=sesion, cuenta=cuenta_destino, tipo="ingreso",
                concepto=concepto, monto=data["monto"], transferencia_id=transferencia_id,
            )

        return Response(CajaMovimientoSerializer(ingreso).data, status=status.HTTP_201_CREATED)
