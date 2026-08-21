import base64
import json
from decimal import Decimal

from rest_framework import serializers

from fiscal.models import ComercioFiscalConfig

from .models import Venta, VentaItem, VentaPago


class VentaItemInputSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal("0.001"))
    peso_kg = serializers.DecimalField(max_digits=14, decimal_places=3, required=False, allow_null=True, default=None)
    # True cuando `cantidad` es cantidad de bolsas (no kg sueltos) — ver
    # VentaViewSet._crear_venta, que resuelve precio_bolsa/bolsa_kg contra el Producto.
    es_bolsa = serializers.BooleanField(default=False)


class VentaPagoInputSerializer(serializers.Serializer):
    """Una línea del cobro: qué cuenta y cuánto entró por ella."""

    cuenta_pago = serializers.UUIDField(required=False, allow_null=True, default=None)
    monto = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))


class VentaCreateSerializer(serializers.Serializer):
    """Input para registrar una venta desde el POS (Fase 2).

    El precio/costo de cada ítem y el total se recalculan en el servidor a
    partir de Producto — nunca se confía en lo que mande el cliente.
    """

    sync_uuid = serializers.UUIDField()
    items = VentaItemInputSerializer(many=True)
    cliente = serializers.UUIDField(required=False, allow_null=True, default=None)
    # Cobro con un solo medio (histórico, y lo que sigue mandando la cola
    # offline con ventas viejas). Para pago mixto se usa `pagos`.
    cuenta_pago = serializers.UUIDField(required=False, allow_null=True, default=None)
    # Pago mixto: una línea por medio usado. Si viene vacío se cae al
    # comportamiento de siempre (todo a `cuenta_pago`, o a efectivo).
    pagos = VentaPagoInputSerializer(many=True, required=False, default=list)
    metodo_pago = serializers.CharField(required=False, allow_blank=True, default="")
    monto_efectivo = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_tarjeta = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_transferencia = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_cuenta_corriente = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    efectivo_recibido = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True, default=None)
    descuento = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    recargo_monto = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    origen = serializers.CharField(required=False, default="pos")

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("La venta necesita al menos un ítem.")
        return items


class VentaItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True, default=None)

    class Meta:
        model = VentaItem
        fields = [
            "id", "producto", "producto_nombre", "combo", "cantidad", "peso_kg",
            "precio_unitario", "costo_unitario", "subtotal",
        ]


class VentaPagoSerializer(serializers.ModelSerializer):
    cuenta_pago_nombre = serializers.CharField(source="cuenta_pago.nombre", read_only=True, default=None)

    class Meta:
        model = VentaPago
        fields = ["id", "cuenta_pago", "cuenta_pago_nombre", "monto"]


class VentaSerializer(serializers.ModelSerializer):
    items = VentaItemSerializer(many=True, read_only=True)
    pagos = VentaPagoSerializer(many=True, read_only=True)
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True, default=None)
    vendedor_nombre = serializers.CharField(source="vendedor.nombre_completo", read_only=True, default=None)
    cuenta_pago_nombre = serializers.CharField(source="cuenta_pago.nombre", read_only=True, default=None)
    qr_url = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = [
            "id", "numero_ticket", "sync_uuid", "vendedor", "vendedor_nombre",
            "cliente", "cliente_nombre", "cuenta_pago", "cuenta_pago_nombre",
            "total", "descuento", "recargo_monto", "metodo_pago",
            "monto_efectivo", "monto_tarjeta", "monto_transferencia", "monto_cuenta_corriente",
            "efectivo_recibido", "vuelto", "origen",
            "anulada", "motivo_anulacion", "fecha_anulacion", "created_at", "items", "pagos",
            "facturado", "cae", "cae_vencimiento", "tipo_factura",
            "numero_factura", "punto_venta_factura", "qr_url",
        ]

    def _config_fiscal(self, comercio_id):
        """Cachea la config fiscal por comercio mientras dura la serialización.

        Con `many=True` DRF reusa una sola instancia del serializer para toda
        la lista, así que este cache convierte "una consulta por cada venta
        facturada" en una sola por comercio. Se usa `comercio_id` y no
        `venta.comercio` a propósito: tocar el FK dispararía otra consulta.
        """
        if not hasattr(self, "_cache_config_fiscal"):
            self._cache_config_fiscal = {}
        if comercio_id not in self._cache_config_fiscal:
            self._cache_config_fiscal[comercio_id] = (
                ComercioFiscalConfig.objects.filter(comercio_id=comercio_id, activo=True)
                .order_by("-es_principal")
                .first()
            )
        return self._cache_config_fiscal[comercio_id]

    def get_qr_url(self, venta):
        """URL del QR obligatorio (RG 4291): un JSON con los datos del
        comprobante, en base64, dentro de un link al validador de ARCA. Se
        arma acá (una sola vez) en vez de en el frontend para no duplicar el
        esquema de campos en dos lenguajes."""
        if not venta.facturado or not venta.cae:
            return None
        config = self._config_fiscal(venta.comercio_id)
        if not config or not config.cuit:
            return None

        fecha = (venta.fecha_facturacion or venta.created_at).date().isoformat()
        payload = {
            "ver": 1,
            "fecha": fecha,
            "cuit": int(config.cuit) if config.cuit.isdigit() else config.cuit,
            "ptoVta": int(venta.punto_venta_factura or 0),
            "tipoCmp": int(venta.tipo_factura or 0),
            "nroCmp": int(venta.numero_factura or 0),
            "importe": float(venta.total),
            "moneda": "PES",
            "ctz": 1,
            "tipoDocRec": 99,
            "nroDocRec": 0,
            "tipoCodAut": "E",
            "codAut": int(venta.cae),
        }
        b64 = base64.b64encode(json.dumps(payload).encode()).decode()
        return f"https://www.afip.gob.ar/fe/qr/?p={b64}"


class VentaAnularSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=300, allow_blank=False, trim_whitespace=True)

    def validate_motivo(self, value):
        if not value.strip():
            raise serializers.ValidationError("El motivo de anulación es obligatorio.")
        return value
