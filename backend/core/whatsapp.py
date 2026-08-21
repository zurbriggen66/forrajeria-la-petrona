import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def formatear_monto_ar(valor):
    """$143.359,08 en vez de $143359.08 — separador de miles con punto, coma
    decimal (formato argentino)."""
    return f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def enviar_whatsapp(telefono, mensaje):
    """Envía un WhatsApp vía el bot QR (whatsapp-bot/). No relanza errores: un
    bot caído no debe frenar una venta ni un movimiento de cuenta corriente."""
    if not settings.WHATSAPP_BOT_URL or not telefono:
        return
    try:
        requests.post(
            f"{settings.WHATSAPP_BOT_URL}/send",
            json={"telefono": telefono, "mensaje": mensaje},
            headers={"x-api-key": settings.WHATSAPP_BOT_API_KEY},
            timeout=5,
        )
    except requests.RequestException:
        logger.warning("No se pudo enviar WhatsApp a %s", telefono, exc_info=True)
