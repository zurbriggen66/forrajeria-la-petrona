from rest_framework import serializers

from .models import AccionPendiente


class ConsultaSerializer(serializers.Serializer):
    mensaje = serializers.CharField(max_length=2000, trim_whitespace=True)
    # El historial vuelve tal cual salió de la respuesta anterior. Se limita el
    # largo para que una conversación eterna no dispare el costo por consulta.
    historial = serializers.ListField(child=serializers.DictField(), required=False, default=list)

    def validate_mensaje(self, value):
        if not value.strip():
            raise serializers.ValidationError("Escribí una pregunta.")
        return value

    def validate_historial(self, value):
        # Se conservan los últimos turnos; el prompt de sistema ya trae el
        # contexto del negocio, así que perder lo viejo no rompe nada.
        return value[-30:]


class ConfirmarSerializer(serializers.Serializer):
    accion = serializers.UUIDField()
    confirmar = serializers.BooleanField(default=True)


class AccionPendienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccionPendiente
        fields = ["id", "tipo", "resumen", "estado", "created_at"]
        read_only_fields = fields


class CuentaSerializer(serializers.Serializer):
    """Configuración de la cuenta de Anthropic del comercio.

    `api_key` es de sólo escritura: entra, se cifra y no vuelve a salir nunca
    por la API.
    """

    api_key = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True, write_only=True)
    modelo = serializers.CharField(required=False, allow_blank=True, max_length=60)

    def validate_api_key(self, value):
        limpio = value.strip()
        # Vacío es válido: significa "borrar la key y volver a la del servidor".
        if limpio and not limpio.startswith("sk-"):
            raise serializers.ValidationError(
                "Una API key de Anthropic empieza con 'sk-'. Copiala de console.anthropic.com."
            )
        return limpio
