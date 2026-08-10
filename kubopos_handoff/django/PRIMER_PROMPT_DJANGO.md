# Prompts de arranque para Claude Code — stack Django + React/Vite

Copiá y pegá en orden. El paquete asume: backend Django REST Framework, frontend React + Vite,
Postgres, mismo modelo de datos que la especificación.

---

## PROMPT 0 — Onboarding

```
Sos el desarrollador principal de este proyecto. Antes de escribir código, leé completos:
README.md, ESPECIFICACION.md, ROADMAP.md, _tables.md, y la carpeta django/ entera
(ARQUITECTURA_DJANGO.md y models.py). Mirá las imágenes de capturas/ para el diseño.

Es la reconstrucción de "Kubo Gestión v2.0", un ERP/POS multi-comercio para comercios de
Argentina. Stack decidido: BACKEND Django + Django REST Framework + PostgreSQL; FRONTEND
React + Vite + TypeScript + TailwindCSS. Multi-tenant por comercio (aislamiento en el backend,
NUNCA solo en el front). Datos transaccionales no se borran, se anulan.

NO programes todavía. Primero:
1. Resumime en 10 líneas la arquitectura que vas a montar.
2. Proponé la estructura de carpetas (repo con backend/ y frontend/, o monorepo).
3. Listame las apps Django que vas a crear y cómo repartís los modelos de django/models.py.
4. Esperá mi OK.
```

---

## PROMPT 1 — Backend base

```
Armá el backend (Fase 0). Creá el proyecto Django con estas apps: core, productos, inventario,
ventas, caja, clientes, kubobots, proveedores, compras, finanzas, fiscal, admin_saas, telemetria.
Repartí los modelos de django/models.py entre esas apps (ajustá imports). Configurá:
- PostgreSQL vía DATABASE_URL (django-environ), .env.example sin secretos.
- DRF + djangorestframework-simplejwt (login/refresh), django-cors-headers, django-filter,
  drf-spectacular.
- Un TenantViewSet mixin que filtra TODO queryset por el comercio del usuario autenticado
  (resuelto desde UsuarioComercio) y setea comercio en perform_create. Soporte de header
  X-Comercio-Id para usuarios con varios comercios, validado contra UsuarioComercio.
Corré makemigrations/migrate. Mostrame cómo levantarlo y el esquema de URLs de la API.
```

---

## PROMPT 2 — Seed y prueba de aislamiento

```
Creá un management command `seed_demo` con datos FICTICIOS: 1 comercio demo, 1 usuario Dueño,
10 categorías, 40 productos variados (algunos por peso, con oferta, y de indumentaria con
talle/color), 5 clientes, 3 proveedores, 3 cuentas de pago. Nunca uses datos reales ni el
comercio_id a6a91020-... Después escribí un test que verifique que un usuario del comercio A
no puede leer ni escribir datos del comercio B a través de la API. Corré los tests.
```

---

## PROMPT 3 — Frontend base (shell + auth)

```
Armá el frontend en frontend/ con React + Vite + TS + Tailwind. Configurá axios con interceptor
JWT (agrega Bearer, refresca token al 401) y TanStack Query. Implementá login contra la API y el
shell de la app: sidebar colapsable con los módulos de la especificación, topbar por módulo,
statusbar (usuario + "CAJA ABIERTA" + estado de conexión). Aplicá el sistema de diseño (tema
oscuro, verde esmeralda; KPI card, tabla, botones, inputs, toasts). Dejá cada módulo como
placeholder. Configurá CORS en Django para el origen del front. Mostrame cómo se ve vs capturas/.
```

---

## De ahí en adelante — una fase por vez (ROADMAP.md)

```
Pasemos a la Fase <N> del ROADMAP (<nombre>). Releé su sección en ESPECIFICACION.md y las
columnas en _tables.md. En el backend: modelos (ya están), serializers, TenantViewSets y
endpoints de acción para la lógica de negocio (con transaction.atomic donde corresponda).
En el frontend: la vista del módulo consumiendo la API, con estados de carga/vacío/error.
Escribí tests de los flujos críticos. No cierres la fase hasta cumplir sus criterios de
aceptación. Hacé un commit descriptivo y decime qué falta.
```

Orden: 1 Productos+Inventario → 2 **POS** (con offline-first / cola en IndexedDB) →
3 Caja+Finanzas → 4 Ventas+Estadísticas → 5 Proveedores+Compras → 6 Clientes+Kubobots →
7 Fiscal (AFIP con Celery, decisión real vs mock) → 8 Admin+Config.

**Regla:** una fase por vez. El POS es lo más valioso; podés priorizarlo apenas tengas productos.
```
