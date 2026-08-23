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


def estado_whatsapp():
    """Estado de vinculación del bot (para el QR en Config). La clave del bot
    nunca llega al navegador: este endpoint la usa server-to-server y el
    frontend sólo ve la respuesta ya resuelta."""
    if not settings.WHATSAPP_BOT_URL:
        return {"estado": "no_configurado", "qr": None}
    try:
        response = requests.get(
            f"{settings.WHATSAPP_BOT_URL}/status",
            headers={"x-api-key": settings.WHATSAPP_BOT_API_KEY},
            timeout=5,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        logger.warning("No se pudo consultar el estado del bot de WhatsApp", exc_info=True)
        return {"estado": "sin_conexion", "qr": None}


def desconectar_whatsapp():
    """Cierra la sesión vinculada (para cambiar de celular): el bot borra las
    credenciales guardadas y arranca de cero, así el próximo /status ya trae
    un QR nuevo para escanear."""
    if not settings.WHATSAPP_BOT_URL:
        return {"estado": "no_configurado", "qr": None}
    try:
        response = requests.post(
            f"{settings.WHATSAPP_BOT_URL}/disconnect",
            headers={"x-api-key": settings.WHATSAPP_BOT_API_KEY},
            timeout=5,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        logger.warning("No se pudo desconectar el bot de WhatsApp", exc_info=True)
        return {"estado": "sin_conexion", "qr": None}
