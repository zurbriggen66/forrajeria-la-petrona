from rest_framework import serializers

from .models import CuentaPago


class CuentaPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuentaPago
        fields = ["id", "nombre", "tipo", "comision_pct", "activo"]
