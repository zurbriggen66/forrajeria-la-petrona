# CLAUDE.md — Kubo Gestión v2.0 (reconstrucción)

Instrucciones para Claude Code al trabajar en este proyecto. Leé también `ESPECIFICACION.md`
(qué es el sistema y su modelo de datos) y `ROADMAP.md` (en qué orden construir).

## Contexto del proyecto
Reconstrucción de **Kubo Gestión / KuboPOS**, un ERP/POS multi-comercio para comercios de Argentina.
SPA modular + backend Supabase (Postgres + Auth + Storage + RPC). Español rioplatense (voseo).
Facturación electrónica AFIP/ARCA. Moneda ARS (`$ 1.234.567,89`).

## Reglas de arquitectura (no negociables)
1. **Multi-tenant por `comercio_id`**: toda tabla de negocio filtra por `comercio_id`. Implementar
   **Row Level Security (RLS)** en Supabase desde el inicio; no confiar solo en el filtro del cliente.
2. **No borrar datos transaccionales**: las ventas se anulan (`anulada=true` + `motivo_anulacion`),
   no se eliminan. Ídem caja y fiscal.
3. **Lógica sensible en el servidor**: fiscal/AFIP, arqueos, aumentos masivos y stock van en RPC o Edge
   Functions con transacciones, no en el cliente.
4. **Módulos independientes**: cada sección (`pos`, `productos`, `inventario`, …) es un módulo aislado
   con su propia vista, estilos y lógica. El shell (sidebar/topbar/footer) es común.
5. **Offline-first en el POS**: el punto de venta debe funcionar sin conexión y sincronizar al reconectar.

## Stack (DECIDIDO)
- **Backend**: Django + Django REST Framework + PostgreSQL (JWT con SimpleJWT).
- **Frontend**: React + Vite + TypeScript + TailwindCSS (TanStack Query + axios).
- Reemplaza el backend Supabase del original; se mantiene el MISMO modelo de datos.

Ver `django/ARQUITECTURA_DJANGO.md` para el detalle, `django/models.py` para los modelos, y
`django/PRIMER_PROMPT_DJANGO.md` para los prompts de arranque. El `schema_detallado.sql` queda como
referencia del esquema (Django genera sus propias migraciones a partir de `models.py`).

> Multi-tenant en el BACKEND: filtrar todo queryset por el comercio del usuario y setear `comercio`
> en `perform_create`. Nunca confiar en el front para el aislamiento.

## Convenciones
- Nombres de tablas/columnas **en español** exactamente como en `ESPECIFICACION.md` (así el schema
  original y el nuevo son intercambiables). Ej: `precio_venta`, `stock_minimo`, `numero_ticket`.
- Formateo de dinero: separador de miles `.`, decimales `,`, prefijo `$ `. Fechas `DD/MM/AAAA`.
- Tema oscuro por defecto usando los tokens de color de la sección "Sistema de diseño".
- Íconos line-style (Lucide). Componentes: KPI card, tabla con acciones, sidebar colapsable, statusbar.
- Estados de carga, error y vacío en cada módulo (no dejar pantallas en blanco).

## Flujo de trabajo con Claude Code
- Trabajá **un módulo por vez** siguiendo `ROADMAP.md`. No intentes todo de una.
- Antes de cada módulo, releé su sección en `ESPECIFICACION.md` y `_tables.md`.
- Escribí **tests** para los flujos críticos (venta, cierre de caja, CAE, aumento masivo).
- Nunca uses el `comercio_id` real del análisis (`a6a91020-...`) ni datos reales: generá seed ficticio.
- Secretos (URL y keys de Supabase, certificados AFIP) van en `.env`, nunca commiteados.
- Corré lint + tests antes de dar por terminado un módulo.

## Archivos de referencia en este repo
- `ESPECIFICACION.md` — visión completa, diseño y modelo de datos.
- `ROADMAP.md` — plan por fases.
- `_tables.md` — columnas observadas por tabla.
- `schema_inicial.sql` — DDL de arranque (inferido; ajustar tipos/constraints).
- `api_urls.txt`, `api_calls.json` — tráfico real observado (fuente de verdad de endpoints).
- `capturas/` — screenshots del sistema en producción.
