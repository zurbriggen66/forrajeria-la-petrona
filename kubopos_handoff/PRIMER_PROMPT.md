# Prompts de arranque para Claude Code

Copiá y pegá estos prompts en Claude Code, en orden. Cada uno corresponde a un momento del proyecto.

---

## PROMPT 0 — Onboarding (el primerísimo, pegá este)

```
Sos el desarrollador principal de este proyecto. Antes de escribir una sola línea de código,
leé completos estos archivos del repo: README.md, CLAUDE.md, ESPECIFICACION.md, ROADMAP.md,
_tables.md y schema_detallado.sql. Mirá también las imágenes de la carpeta capturas/ para
entender el diseño.

Es la reconstrucción de "Kubo Gestión v2.0", un ERP/POS multi-comercio para comercios de
Argentina, con backend Supabase. Quiero mantener el mismo modelo de datos (nombres de tablas
y columnas en español, iguales a la especificación) y un diseño equivalente: tema oscuro,
acento verde esmeralda, sidebar + topbar + statusbar.

NO empieces a programar todavía. Primero:
1. Resumime en 10 líneas qué entendiste del sistema y su arquitectura.
2. Decime qué decisiones necesitás que tome antes de arrancar (stack, etc.).
3. Proponé la estructura de carpetas del repo.
4. Esperá mi confirmación antes de generar código.
```

---

## PROMPT 1 — Definir el stack (respondé lo que te pregunte, o forzá uno)

Si querés fijar el stack recomendado directamente:

```
Usá este stack: React + Vite + TypeScript + TailwindCSS en el frontend, y Supabase
(Postgres + Auth + Storage + Realtime + Edge Functions) en el backend. Estado del servidor
con TanStack Query. Router con hash routing para respetar las rutas #/... del original.
Estructura por módulos: src/modules/<modulo>/ con su vista, hooks y componentes; un shell
común (sidebar/topbar/statusbar) en src/shell/. Tests con Vitest + Testing Library.

Configurá el proyecto base (Fase 0 del ROADMAP): repo, Vite, Tailwind con los tokens de
color de la especificación, cliente de Supabase leyendo credenciales de .env, y un .env.example.
No subas secretos. Cuando termines, mostrame cómo correrlo y seguimos con auth + shell.
```

> Si preferís mantenerte fiel al original (sin framework): reemplazá la primera frase por
> "Usá HTML + CSS + JavaScript vanilla con Web Components y @supabase/supabase-js, sin framework."

---

## PROMPT 2 — Base de datos

```
Aplicá schema_detallado.sql en Supabase. Después:
1. Escribí las políticas RLS concretas para cada tabla usando la función pertenece_comercio(),
   siguiendo el ejemplo del final del SQL. Para tablas hijas sin comercio_id (combo_items,
   ventas_items, presupuestos_items, compras_items, consumos_internos_items) validá contra el padre.
2. Creá un seed con datos FICTICIOS: 1 comercio demo, 1 usuario Dueño, 10 categorías, 40 productos
   variados (algunos por peso, algunos con oferta, algunos de indumentaria con talle/color), 5 clientes,
   3 proveedores, 3 cuentas de pago. Nunca uses datos reales ni el comercio_id a6a91020-...
3. Confirmá que un usuario del comercio A no puede leer datos del comercio B (probalo).
```

---

## PROMPT 3 — Fase 0: Shell + Auth

```
Implementá la Fase 0 del ROADMAP: login por email/password con Supabase Auth, sesión persistente,
guard de rutas, y el shell de la app (sidebar colapsable con los módulos de la especificación,
topbar por módulo, statusbar con usuario + "CAJA ABIERTA" + estado de conexión). Aplicá el sistema
de diseño (tema oscuro, verde esmeralda, KPI card, tabla, botones, inputs, toasts). Dejá cada
módulo como placeholder "Cargando módulo…" que luego iremos completando. Mostrame capturas o
el HTML resultante y cómo se ve contra las imágenes de capturas/.
```

---

## De ahí en adelante

Seguí una fase por vez con este patrón:

```
Pasemos a la Fase <N> del ROADMAP (<nombre>). Releé su sección en ESPECIFICACION.md y las
columnas en _tables.md. Implementá el módulo completo con estados de carga/vacío/error, escribí
tests de los flujos críticos, y no cierres la fase hasta cumplir sus criterios de aceptación.
Cuando termines, hacé un commit con un mensaje descriptivo y decime qué falta.
```

Orden sugerido (del ROADMAP): 1 Productos+Inventario → 2 **POS** → 3 Caja+Finanzas →
4 Ventas+Estadísticas → 5 Proveedores+Compras → 6 Clientes+Kubobots → 7 Fiscal → 8 Admin+Config.

**Regla:** no dejes que avance dos fases juntas. El POS (Fase 2) es lo más valioso; si querés ver
resultados rápido, se puede priorizar POS justo después de tener Productos cargados.
