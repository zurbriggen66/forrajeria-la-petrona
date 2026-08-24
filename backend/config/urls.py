"""
URL configuration for TIENDA-IA (config project).

- /admin/                     — Django admin
- /api/auth/token/            — login (JWT: access + refresh)
- /api/auth/token/refresh/    — refresh de access token
- /api/auth/me/               — perfil del usuario autenticado + comercios que opera
- /api/schema/, /api/docs/    — OpenAPI schema y Swagger UI (sólo con DEBUG)

Los endpoints por módulo (productos, ventas, caja, ...) se agregan fase a fase
siguiendo ROADMAP.md, montados bajo /api/<modulo>/.
"""

from django.conf import settings
from django.contrib import admin
from django.http import Http404, HttpResponse
from django.urls import include, path, re_path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

FRONTEND_INDEX = settings.BASE_DIR.parent / "frontend" / "dist" / "index.html"


def spa_index(request, **kwargs):
    """Sirve el index.html del SPA para cualquier ruta de React Router.

    En el VPS esto lo resuelve nginx (`try_files $uri /index.html`). Acá no
    hay nginx delante (PythonAnywhere), así que Django hace el mismo fallback:
    todo lo que no matchee /api/, /admin/ o /static/ cae acá.
    """
    if not FRONTEND_INDEX.exists():
        raise Http404
    return HttpResponse(FRONTEND_INDEX.read_bytes(), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/", include("core.urls")),
    path("api/", include("productos.urls")),
    path("api/", include("proveedores.urls")),
    path("api/", include("compras.urls")),
    path("api/", include("caja.urls")),
    path("api/", include("clientes.urls")),
    path("api/", include("ventas.urls")),
    path("api/", include("repartos.urls")),
    path("api/asistente/", include("asistente.urls")),
    path("api/finanzas/", include("finanzas.urls")),
    path("api/inventario/", include("inventario.urls")),
    path("api/estadisticas/", include("estadisticas.urls")),
    path("api/admin/", include("admin_saas.urls")),
    path("api/fiscal/", include("fiscal.urls")),
]

# La documentación de la API describe todos los endpoints y su forma: útil
# mientras se desarrolla, innecesario en el servidor del comercio.
if settings.DEBUG:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    ]

# Catch-all del SPA — tiene que ir último: cualquier ruta que no matcheó
# arriba (api/, admin/) es una ruta de React Router (/pos, /clientes, ...).
urlpatterns += [
    re_path(r"^(?!api/|admin/|static/).*$", spa_index, name="spa"),
]
