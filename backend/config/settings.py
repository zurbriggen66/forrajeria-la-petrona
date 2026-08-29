"""
Django settings for TIENDA-IA (config project).
"""

from datetime import timedelta
from pathlib import Path

import environ
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

# Sin default a propósito: si falta SECRET_KEY tiene que romper el arranque,
# no bootear en silencio con una clave conocida y firmar sesiones con eso.
SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # terceros
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # apps del dominio (TIENDA-IA)
    "core",
    "productos",
    "inventario",
    "ventas",
    "caja",
    "clientes",
    "kubobots",
    "proveedores",
    "compras",
    "repartos",
    "asistente",
    "finanzas",
    "estadisticas",
    "fiscal",
    "admin_saas",
    "telemetria",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# Por defecto SQLite para desarrollo (no requiere instalar nada localmente).
# Para Postgres, definí DATABASE_URL en .env, ej:
#   DATABASE_URL=postgres://usuario:password@localhost:5432/kubopos
# NOTA (ver CLAUDE.md / ARQUITECTURA_DJANGO.md): en producción usar PostgreSQL,
# no SQLite (JSONField, UUID, decimales y concurrencia de caja lo requieren).
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Internacionalización — mercado argentino (español rioplatense, ARS, America/Argentina)

LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True


# Static files

STATIC_URL = "static/"
# Destino de collectstatic. En producción nginx sirve /static/ desde acá; sin
# esto collectstatic ni siquiera corre y el admin queda sin estilos.
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# Producción — nada de esto hace falta con runserver en localhost.
# ---------------------------------------------------------------------------
# Detrás de nginx, Django ve HTTP aunque el navegador hable HTTPS. Sin esto se
# arma un loop de redirecciones con SECURE_SSL_REDIRECT y request.is_secure()
# miente.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Django exige el origen exacto (con esquema) para POST del admin sobre HTTPS;
# ALLOWED_HOSTS no alcanza y el login devuelve 403.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True


# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # ModuloHabilitado: el Dueño puede apagarle módulos a cada empleado
    # (core/modulos.py). Va en el default para que una vista nueva quede
    # cubierta sin que nadie se acuerde; las vistas que declaran
    # `permission_classes` propio lo listan a mano.
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
        "core.permissions.ModuloHabilitado",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
    ),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.PaginacionEstandar",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "TIENDA-IA API",
    "DESCRIPTION": "ERP/POS multi-comercio — API Django REST Framework",
    "VERSION": "2.0.0",
}


# ---------------------------------------------------------------------------
# CORS — origen del frontend (Vite)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:5173", "http://127.0.0.1:5173"]
)
CORS_ALLOW_CREDENTIALS = True

# Header con el comercio activo cuando un usuario opera varios comercios
# (ver core/mixins.py::resolver_comercio_activo) — hay que declararlo explícito
# o el preflight CORS lo rechaza antes de que la request llegue a la vista.
CORS_ALLOW_HEADERS = (*default_headers, "x-comercio-id")

COMERCIO_ACTIVO_HEADER = "HTTP_X_COMERCIO_ID"


# ---------------------------------------------------------------------------
# WhatsApp — bot propio vinculado por QR (whatsapp-bot/), vacío = desactivado
# ---------------------------------------------------------------------------
WHATSAPP_BOT_URL = env("WHATSAPP_BOT_URL", default="")
WHATSAPP_BOT_API_KEY = env("WHATSAPP_BOT_API_KEY", default="")


# ---------------------------------------------------------------------------
# Asistente (Claude) — vacío = el asistente queda apagado y el resto sigue igual.
# La key vive sólo en el servidor: el frontend nunca la ve ni la manda.
# ---------------------------------------------------------------------------
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
ASISTENTE_MODELO = env("ASISTENTE_MODELO", default="claude-opus-5")
# Cuánto "piensa" antes de responder. Las consultas del mostrador son simples
# (mirar un dato y contestarlo); subir esto encarece cada pregunta.
ASISTENTE_EFFORT = env("ASISTENTE_EFFORT", default="medium")
