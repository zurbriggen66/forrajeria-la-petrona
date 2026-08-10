# Arquitectura — Kubo Gestión v2.0 con Django + React/Vite

Reconstrucción del sistema con **Django REST Framework (backend/API)** + **React + Vite (frontend SPA)**.
Reemplaza el backend Supabase del original por Django, manteniendo el mismo modelo de datos.

## Visión general
```
┌──────────────────────┐        HTTPS / JSON        ┌──────────────────────────┐
│  Frontend             │  ───────────────────────▶ │  Backend                  │
│  React + Vite + TS    │      (JWT en header)       │  Django + DRF             │
│  Tailwind + Router     │ ◀───────────────────────  │  PostgreSQL               │
│  TanStack Query        │                            │  Celery + Redis (async)   │
└──────────────────────┘                            └──────────────────────────┘
                                                          │
                                                          ▼
                                              AFIP/ARCA (WSFEv1) para CAE
```

## Backend (Django)
- **Django 5 + Django REST Framework**. PostgreSQL (no SQLite en producción: hay `JSONField`,
  `UUID`, decimales y concurrencia de caja).
- **Apps sugeridas** (una por dominio): `core` (Comercio, Perfil, usuarios), `productos`,
  `inventario`, `ventas`, `caja`, `clientes`, `kubobots`, `proveedores`, `compras`, `finanzas`,
  `fiscal`, `admin_saas`, `telemetria`. Repartí `models.py` entre ellas.
- **Auth**: JWT con `djangorestframework-simplejwt` (login → access+refresh token). El front guarda
  el token y lo manda en `Authorization: Bearer`.
- **Multi-tenant (clave)**: el aislamiento por `comercio` NO puede quedar en el front.
  Implementalo en el backend con un patrón consistente:
  - Un middleware o un mixin de `ViewSet` que resuelve el `comercio` del usuario autenticado
    (desde `UsuarioComercio`) y **filtra todo queryset** por ese comercio.
  - Al crear objetos, setear `comercio` automáticamente en `perform_create`, nunca desde el body.
  - Ejemplo de mixin:
    ```python
    class TenantViewSet(viewsets.ModelViewSet):
        def get_queryset(self):
            return super().get_queryset().filter(comercio=self.request.comercio)
        def perform_create(self, serializer):
            serializer.save(comercio=self.request.comercio)
    ```
  - Si un usuario opera varios comercios, el comercio activo va en un header (`X-Comercio-Id`)
    validado contra `UsuarioComercio`.
- **Lógica de negocio en transacciones** (`transaction.atomic`): registrar venta + ítems +
  descontar stock + movimiento de caja debe ser atómico. Nunca borrar ventas: `anulada=True`.
- **Tareas async con Celery + Redis**: emisión de CAE ante AFIP, parseo de facturas de proveedor,
  envíos de WhatsApp, recálculos pesados de estadísticas.
- **Fiscal/AFIP**: usar una lib Python (p. ej. `pyafipws` / `afip` / `wsfev1`). El certificado y la
  clave privada van en variables de entorno o gestor de secretos, jamás en la base ni en el repo.
- **DRF extras**: `django-filter` (filtros de estadísticas), paginación, `drf-spectacular`
  (documentación OpenAPI para que el front consuma tipos).

## Frontend (React + Vite)
- **React + Vite + TypeScript + TailwindCSS**. Router con React Router. Estado del servidor con
  **TanStack Query**. Cliente HTTP: `axios` con interceptor que agrega el JWT y refresca el token.
- **Estructura por módulos**: `src/modules/<modulo>/` (POS, productos, inventario, …) + un shell común
  `src/shell/` (sidebar colapsable, topbar por módulo, statusbar). Rutas que respetan el original.
- **Diseño**: tokens de color de `ESPECIFICACION.md` (tema oscuro, verde esmeralda). Componentes base:
  KPI card, tabla con acciones, modales, toasts, estados de carga/vacío/error.
- **POS offline-first**: cola de ventas en IndexedDB que sincroniza contra la API al reconectar.
  Convertí el front en PWA (`vite-plugin-pwa`).

## CORS y despliegue
- `django-cors-headers` para permitir el origen del front.
- Servir el build de Vite como estático (WhiteNoise) o desde un hosting de estáticos aparte (ver hosting).
- Variables: `DATABASE_URL`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, secretos AFIP.

## Diferencias vs. el original (Supabase → Django)
| Original (Supabase) | En Django |
|---|---|
| PostgREST (`/rest/v1/tabla`) | Endpoints DRF (`/api/productos/`, etc.) |
| RLS por `comercio_id` | Filtro por comercio en ViewSets + permisos |
| Funciones RPC de Postgres | Endpoints de acción DRF (`@action`) o servicios |
| Supabase Auth | SimpleJWT (o allauth) |
| Supabase Storage | Django storage (S3 / disco / Cloudinary) |
| Realtime channels | WebSockets con Django Channels (opcional) o polling |
| Edge Functions (fiscal) | Tareas Celery / vistas dedicadas |

Las funciones RPC del original a replicar como endpoints: `get_top_products`,
`get_suscripcion_actual`, `admin_fiscal_dashboard`, `admin_list_comercios`, `admin_get_balance_saas`,
`kubobots_misiones_estado`, etc. (ver `ESPECIFICACION.md`).
