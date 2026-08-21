from rest_framework import serializers

from .models import ComercioFiscalConfig, FiscalQueue


class ComercioFiscalConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComercioFiscalConfig
        fields = [
            "id", "cuit", "razon_social", "punto_venta", "condicion_iva",
            "es_principal", "cert_ref", "homologacion", "activo",
        ]
        read_only_fields = ["id"]


class FiscalQueueSerializer(serializers.ModelSerializer):
    venta_numero_ticket = serializers.IntegerField(source="venta.numero_ticket", read_only=True, default=None)

    class Meta:
        model = FiscalQueue
        fields = [
            "id", "venta", "venta_numero_ticket", "status", "cae", "cae_vencimiento",
            "punto_venta", "numero_factura", "tipo_comprobante", "error_msg", "created_at",
        ]
        read_only_fields = fields
