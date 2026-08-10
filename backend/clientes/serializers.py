from rest_framework import serializers

from .models import Cliente


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = [
            "id", "nombre", "telefono", "celular", "email", "tipo",
            "saldo_actual", "limite_credito", "kubobots_fid_off", "activo",
        ]
