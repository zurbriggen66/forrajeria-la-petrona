"""API del asistente: consultar (conversar) y confirmar (ejecutar la propuesta)."""
import json
from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import resolver_comercio_activo
from core.permissions import IsDueño
from productos.models import Producto
from productos.precios import resolver_precio_item

from .claude import AsistenteNoConfigurado, conversar, credenciales
from .claves import cifrar, descifrar, enmascarar
from .cuota import CuotaAgotada, registrar, resumen as resumen_de_uso, verificar
from .models import AccionPendiente
from .serializers import (
    AccionPendienteSerializer,
    ConfirmarSerializer,
    ConsultaSerializer,
    CuentaSerializer,
)


def _decimal(valor, por_defecto="0"):
    try:
        return Decimal(str(valor if valor not in (None, "") else por_defecto))
    except (InvalidOperation, ValueError):
        return Decimal(por_defecto)


def _plata(monto):
    return f"$ {monto:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")


class ConsultarView(APIView):
    """Manda un mensaje al asistente y devuelve su respuesta.

    El historial viaja en el request (la API de Claude no guarda estado) y se
    devuelve actualizado para el siguiente mensaje. No se persiste: una
    conversación con el asistente no es un registro del negocio.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ConsultaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)

        # El cupo se chequea ANTES de llamar a la API: una consulta que se
        # pasa del límite no se paga.
        try:
            verificar(comercio)
        except CuotaAgotada as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        historial = serializer.validated_data["historial"]
        historial.append({"role": "user", "content": serializer.validated_data["mensaje"]})

        propuestas = []

        def on_proponer(tipo, datos):
            """Guarda la acción como pendiente y le avisa al modelo que no se
            ejecutó — así no le dice al usuario que ya está hecho."""
            try:
                resumen, datos_normalizados = _preparar(comercio, tipo, datos)
            except ValueError as exc:
                return json.dumps({"error": str(exc)}, ensure_ascii=False)

            accion = AccionPendiente.objects.create(
                comercio=comercio, usuario=request.user, tipo=tipo,
                resumen=resumen, datos=datos_normalizados,
            )
            propuestas.append(accion)
            return json.dumps({
                "estado": "propuesta_creada_pendiente_de_confirmacion",
                "resumen": resumen,
                "aviso": "Todavía NO se ejecutó. La tiene que confirmar el usuario en pantalla.",
            }, ensure_ascii=False)

        try:
            texto, historial, uso = conversar(comercio, historial, on_proponer)
        except AsistenteNoConfigurado as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Se descuenta después de responder: si la llamada falla, no se gasta
        # una consulta del cupo del usuario.
        registrar(comercio, uso)

        return Response({
            "respuesta": texto,
            "historial": historial,
            "accion_pendiente": (
                AccionPendienteSerializer(propuestas[-1]).data if propuestas else None
            ),
            # El costo se calcula con el modelo que realmente usó este
            # comercio, no con el default del servidor.
            "cuota": resumen_de_uso(comercio, credenciales(comercio)[1]),
        })


MODELOS_DISPONIBLES = [
    {"id": "claude-opus-5", "nombre": "Opus 5", "detalle": "El más capaz. US$ 5 / 25 por millón de tokens."},
    {"id": "claude-sonnet-5", "nombre": "Sonnet 5", "detalle": "Equilibrio entre calidad y costo. US$ 2 / 10."},
    {"id": "claude-haiku-4-5", "nombre": "Haiku 4.5", "detalle": "El más rápido y barato. US$ 1 / 5."},
]


class CuentaView(APIView):
    """La cuenta de Anthropic con la que consulta este comercio.

    Cargando su propia API key, el comercio le factura directamente a
    Anthropic y elige su modelo. Sin key, usa la del servidor — la de quien
    administra el sistema.

    La key NUNCA se devuelve: sólo si está cargada y sus últimos 4 caracteres.
    """

    permission_classes = [IsAuthenticated, IsDueño]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        propia = descifrar(comercio.asistente_api_key_cifrada)
        _key, modelo, origen = credenciales(comercio)
        return Response({
            "tiene_key_propia": bool(propia),
            "key_enmascarada": enmascarar(propia),
            "factura": origen,
            "modelo": modelo,
            "modelos_disponibles": MODELOS_DISPONIBLES,
            "consultas_diarias": comercio.asistente_consultas_diarias,
        })

    def post(self, request):
        comercio = resolver_comercio_activo(request)
        serializer = CuentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        campos = []
        if "api_key" in datos:
            # Cadena vacía = borrar la key y volver a la cuenta del servidor.
            comercio.asistente_api_key_cifrada = cifrar(datos["api_key"].strip())
            campos.append("asistente_api_key_cifrada")
        if "modelo" in datos:
            comercio.asistente_modelo = datos["modelo"]
            campos.append("asistente_modelo")
        if campos:
            comercio.save(update_fields=campos + ["updated_at"])

        return self.get(request)


class UsoView(APIView):
    """Cuánto cupo queda y cuánto se gastó — para mostrarlo en pantalla y
    para poder cotizar el servicio con consumo real, no con estimaciones."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        comercio = resolver_comercio_activo(request)
        dias = min(int(request.query_params.get("dias", 30)), 365)
        return Response(resumen_de_uso(comercio, credenciales(comercio)[1], dias=dias))


def _preparar(comercio, tipo, datos):
    """Valida la propuesta contra la base y arma el resumen que ve la persona.

    Se valida acá (y no recién al confirmar) para que el usuario no confirme
    algo que después va a fallar, y para que el resumen muestre precios reales
    y no los que el modelo haya supuesto.
    """
    if tipo == "alta_producto":
        nombre = (datos.get("nombre") or "").strip()
        if not nombre:
            raise ValueError("Falta el nombre del producto.")
        precio = _decimal(datos.get("precio_venta"))
        if precio <= 0:
            raise ValueError("El precio de venta tiene que ser mayor a cero.")

        normalizado = {
            "nombre": nombre,
            "precio_venta": str(precio),
            "precio_costo": str(_decimal(datos.get("precio_costo"))),
            "stock": str(_decimal(datos.get("stock"))),
            "categoria": (datos.get("categoria") or "").strip(),
            "venta_por_peso": bool(datos.get("venta_por_peso")),
            "bolsa_kg": str(_decimal(datos.get("bolsa_kg"))) if datos.get("bolsa_kg") else "",
            "precio_bolsa": str(_decimal(datos.get("precio_bolsa"))) if datos.get("precio_bolsa") else "",
        }
        unidad = "kg" if normalizado["venta_por_peso"] else "unidad"
        lineas = [
            f"Producto: {nombre}",
            f"Precio de venta: {_plata(precio)} por {unidad}",
            f"Stock inicial: {normalizado['stock']} {unidad}",
        ]
        if normalizado["categoria"]:
            lineas.append(f"Categoría: {normalizado['categoria']}")
        if normalizado["bolsa_kg"] and normalizado["precio_bolsa"]:
            lineas.append(
                f"Bolsa de {normalizado['bolsa_kg']}kg a {_plata(_decimal(normalizado['precio_bolsa']))}"
            )
        return "\n".join(lineas), normalizado

    if tipo == "venta":
        items = datos.get("items") or []
        if not items:
            raise ValueError("La venta no tiene productos.")

        lineas, normalizados, total = [], [], Decimal("0")
        for item in items:
            producto = Producto.objects.filter(
                comercio=comercio, id=item.get("producto_id"), activo=True
            ).first()
            if producto is None:
                raise ValueError(
                    f"No encontré el producto {item.get('producto_id')}. Buscalo con buscar_producto y usá su id."
                )
            cantidad = _decimal(item.get("cantidad"))
            if cantidad <= 0:
                raise ValueError(f"La cantidad de {producto.nombre} tiene que ser mayor a cero.")
            es_bolsa = bool(item.get("es_bolsa"))
            # Precio real del catálogo, con la misma regla que el POS.
            precio, _costo, kg = resolver_precio_item(producto, cantidad, es_bolsa)
            if producto.stock < kg:
                raise ValueError(
                    f"No hay stock suficiente de {producto.nombre}: quedan {producto.stock}."
                )
            subtotal = (precio * cantidad).quantize(Decimal("0.01"))
            total += subtotal
            unidad = (
                f"bolsa{'s' if cantidad != 1 else ''} de {producto.bolsa_kg}kg" if es_bolsa
                else (producto.unidad_medida if producto.venta_por_peso else "u.")
            )
            lineas.append(f"{cantidad} {unidad} · {producto.nombre} — {_plata(subtotal)}")
            normalizados.append({
                "producto": str(producto.id), "cantidad": str(cantidad), "es_bolsa": es_bolsa,
            })

        lineas.append(f"TOTAL: {_plata(total)}")
        return "\n".join(lineas), {"items": normalizados, "total_estimado": str(total)}

    raise ValueError(f"Tipo de acción desconocido: {tipo}")


class ConfirmarView(APIView):
    """Ejecuta una acción que el asistente propuso, después de que una persona
    la confirmó. Reusa exactamente los mismos caminos que la interfaz normal,
    así que valida stock, precios y caja igual que si se hubiera cargado a mano."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ConfirmarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comercio = resolver_comercio_activo(request)

        accion = AccionPendiente.objects.filter(
            comercio=comercio, id=serializer.validated_data["accion"]
        ).first()
        if accion is None:
            return Response({"detail": "Esa acción no existe."}, status=status.HTTP_404_NOT_FOUND)
        if accion.estado != "pendiente":
            return Response(
                {"detail": f"Esa acción ya está {accion.get_estado_display()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not serializer.validated_data["confirmar"]:
            accion.estado = "cancelada"
            accion.save(update_fields=["estado", "updated_at"])
            return Response({"estado": "cancelada", "mensaje": "Listo, no hice nada."})

        if accion.tipo == "alta_producto":
            return self._crear_producto(request, comercio, accion)
        return self._registrar_venta(request, comercio, accion)

    def _crear_producto(self, request, comercio, accion):
        from productos.serializers import ProductoSerializer

        datos = dict(accion.datos)
        entrada = {
            "nombre": datos["nombre"],
            "precio_venta": datos["precio_venta"],
            "precio_costo": datos["precio_costo"],
            "stock": datos["stock"],
            "categoria": datos["categoria"],
            "venta_por_peso": datos["venta_por_peso"],
            "unidad_medida": "kg" if datos["venta_por_peso"] else "unidad",
        }
        if datos.get("bolsa_kg") and datos.get("precio_bolsa"):
            entrada["bolsa_kg"] = datos["bolsa_kg"]
            entrada["precio_bolsa"] = datos["precio_bolsa"]

        serializer = ProductoSerializer(data=entrada)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            producto = serializer.save(comercio=comercio)
            accion.estado = "confirmada"
            accion.resultado_id = producto.id
            accion.save(update_fields=["estado", "resultado_id", "updated_at"])

        return Response({
            "estado": "confirmada",
            "mensaje": f'Cargué "{producto.nombre}".',
            "producto": ProductoSerializer(producto).data,
        }, status=status.HTTP_201_CREATED)

    def _registrar_venta(self, request, comercio, accion):
        """La venta se registra por el mismo camino que el POS: mismo control
        de stock, misma caja, mismo número de ticket."""
        import uuid

        from ventas.serializers import VentaCreateSerializer, VentaSerializer
        from ventas.views import VentaViewSet

        entrada = {
            "sync_uuid": str(uuid.uuid4()),
            "items": accion.datos["items"],
            "origen": "asistente",
        }
        serializer = VentaCreateSerializer(data=entrada)
        serializer.is_valid(raise_exception=True)

        venta = VentaViewSet()._crear_venta(request, comercio, serializer.validated_data)
        accion.estado = "confirmada"
        accion.resultado_id = venta.id
        accion.save(update_fields=["estado", "resultado_id", "updated_at"])

        return Response({
            "estado": "confirmada",
            "mensaje": f"Registré la venta con el ticket #{venta.numero_ticket}.",
            "venta": VentaSerializer(venta).data,
        }, status=status.HTTP_201_CREATED)
