"""
URL configuration for TIENDA-IA (config project).

- /admin/                     — Django admin
- /api/auth/token/            — login (JWT: access + refresh)
- /api/auth/token/refresh/    — refresh de access token
- /api/auth/me/               — perfil del usuario autenticado + comercios que opera
- /api/schema/, /api/docs/    — OpenAPI schema y Swagger UI (drf-spectacular)

Los endpoints por módulo (productos, ventas, caja, ...) se agregan fase a fase
siguiendo ROADMAP.md, montados bajo /api/<modulo>/.
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/", include("core.urls")),
    path("api/", include("productos.urls")),
    path("api/", include("proveedores.urls")),
    path("api/", include("caja.urls")),
    path("api/", include("clientes.urls")),
    path("api/", include("ventas.urls")),
    path("api/inventario/", include("inventario.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
