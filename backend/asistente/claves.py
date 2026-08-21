"""Guardado de la API key de cada comercio.

La key se cifra antes de tocar la base: si alguien se lleva un dump del
Postgres, no se lleva las credenciales de facturación de los clientes.

El cifrado se deriva de SECRET_KEY, así que rotar SECRET_KEY invalida las
keys guardadas — hay que volver a cargarlas. Es el precio de no tener que
administrar un segundo secreto, y está bien para este tamaño de sistema.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet():
    # Fernet necesita 32 bytes en base64 urlsafe; SHA-256 de SECRET_KEY los da.
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def cifrar(texto):
    if not texto:
        return ""
    return _fernet().encrypt(texto.encode()).decode()


def descifrar(guardado):
    """Devuelve la key en claro, o "" si no se puede (SECRET_KEY rotada,
    dato corrupto). Nunca revienta: el asistente se apaga, el sistema sigue."""
    if not guardado:
        return ""
    try:
        return _fernet().decrypt(guardado.encode()).decode()
    except (InvalidToken, ValueError):
        return ""


def enmascarar(clave):
    """Cómo se le muestra al usuario que ya hay una key cargada, sin mostrarla."""
    if not clave:
        return ""
    return f"…{clave[-4:]}" if len(clave) > 4 else "…"
