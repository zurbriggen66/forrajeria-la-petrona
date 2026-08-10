# Paquete de arranque — Reconstrucción de Kubo Gestión v2.0

Todo lo que Claude Code necesita para reconstruir y mejorar el sistema **Kubo Gestión / KuboPOS**.
Descomprimí esta carpeta en un repo vacío y empezá.

## Cómo usarlo con Claude Code
1. Poné estos archivos en la raíz de tu repo nuevo (el `CLAUDE.md` va en la raíz para que Claude Code
   lo lea automáticamente en cada sesión).
2. Abrí Claude Code en esa carpeta y pedile: *"Leé CLAUDE.md, ESPECIFICACION.md y ROADMAP.md y arrancá
   con la Fase 0"*.
3. Antes de empezar, **decidile el stack** (fiel al original en HTML/JS+Supabase, o moderno en
   React+Vite+TS+Tailwind+Supabase). Está marcado como decisión pendiente en `CLAUDE.md`.
4. Avanzá **una fase por vez** siguiendo `ROADMAP.md`.

## Contenido
| Archivo | Qué es |
|---|---|
| `CLAUDE.md` | Instrucciones permanentes para Claude Code (reglas de arquitectura, convenciones). |
| `ESPECIFICACION.md` | Qué es el sistema, diseño, navegación y modelo de datos completo. |
| `ROADMAP.md` | Plan de construcción en 9 fases con criterios de aceptación. |
| `schema_detallado.sql` | **DDL completo** para Supabase: tipos, FKs, índices y RLS (usar este). |
| `schema_inicial.sql` | Versión mínima autogenerada (referencia). |
| `PRIMER_PROMPT.md` | Prompts listos para pegar en Claude Code, en orden. |
| `_tables.md` | Columnas observadas por cada una de las 55 tablas. |
| `api_urls.txt` | URLs de API únicas observadas. |
| `api_calls.json` | 710 requests reales (método + URL): fuente de verdad de endpoints. |
| `capturas/` | Screenshots del sistema en producción (referencia visual). |
| `django/` | **Stack elegido: Django + React/Vite.** Contiene `models.py`, `ARQUITECTURA_DJANGO.md` y `PRIMER_PROMPT_DJANGO.md`. Empezá por acá. |

## Importante
- Todo el modelo de datos está **inferido** por ingeniería inversa del tráfico. Si tenés acceso al
  proyecto Supabase original, exportá el schema real (`pg_dump --schema-only`): esa es la fuente de verdad.
- No reutilices el `comercio_id` real que aparece en el análisis (`a6a91020-...`) ni datos reales.
- La facturación AFIP/ARCA es el punto más delicado: definí si se integra de verdad o se mockea.
