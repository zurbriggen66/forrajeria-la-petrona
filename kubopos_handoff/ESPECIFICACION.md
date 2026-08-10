# Kubo Gestión v2.0 — Especificación para reconstruir y mejorar

> Documento de arranque para reconstruir el sistema **Kubo Gestión (KuboPOS)** con Claude Code.
> Reconstruido por ingeniería inversa a partir del análisis de red y capturas del sistema en producción
> (`kubopos.kanodedigital.com`). Fecha del análisis: 08/08/2026.

---

## 1. Qué es

Kubo Gestión es un **ERP/POS en la nube para comercios de Argentina** (kiosco, almacén, heladería,
indumentaria, etc.). Es una **SPA (single page application)** con arquitectura modular: un shell
principal (sidebar + topbar + footer) que carga módulos bajo demanda (`Cargando módulo…`). Cada módulo
vive en su propia carpeta con `html` + `css` + `js`.

El backend es **100% Supabase**: base de datos Postgres accedida vía PostgREST (`/rest/v1/`), autenticación
Supabase Auth (`/auth/v1/token`), Storage para imágenes de productos, y funciones RPC de Postgres para lógica
de negocio y reportes. Es **multi-comercio (multi-tenant)**: casi todas las tablas filtran por `comercio_id`.

- Dominio: `kubopos.kanodedigital.com`
- Backend Supabase: `https://etrsahmdgkoissdgcbvx.supabase.co`
- Versionado por `version.json` (para forzar refresco de la SPA)
- Marca: **"Kubo Gestión"** con badge `v2.0`, logo en verde esmeralda.

### Tono / mercado
Español rioplatense (voseo: "Ajustá el período que querés analizar"). Facturación electrónica **AFIP/ARCA**
(CAE, punto de venta, tipos de comprobante). Moneda ARS con formato `$ 1.682.555,75`.

---

## 2. Sistema de diseño (design system)

Tema **oscuro** por defecto. Extraído de las capturas:

| Token | Valor aproximado | Uso |
|---|---|---|
| `--bg` | `#0a0e1a` / `#0b1120` (azul-negro muy oscuro) | Fondo general |
| `--surface` | `#111827` / `#0f1729` | Tarjetas, sidebar |
| `--surface-2` | `#1a2234` | Inputs, filas hover |
| `--border` | `#1f2937` | Bordes sutiles |
| `--accent` | `#10b981` / `#22c55e` (verde esmeralda) | Marca, activo, éxito, "Conectado" |
| `--accent-blue` | `#3b82f6` | Botones primarios de acción ("Stock Rápido", "Aplicar") |
| `--warning` | `#f59e0b` (ámbar) | Stock bajo, alertas |
| `--danger` | `#ef4444` (rojo) | Sin stock, "Cerrar Sesión", anular |
| `--purple` | `#8b5cf6` | Algunos KPIs (balance, margen) |
| `--text` | `#e5e7eb` | Texto principal |
| `--text-dim` | `#9ca3af` | Texto secundario, labels en MAYÚSCULA |

Componentes visuales clave:
- **Sidebar** fija a la izquierda (~250px), con logo arriba, ítems con ícono + label, secciones colapsables
  (Productos, Inventario, Ventas, Estadísticas tienen submenú con chevron), estado "● Conectado" abajo y
  botón rojo "Cerrar Sesión".
- **Topbar** por módulo: título grande a la izquierda, botones de acción a la derecha (ej. "Actualizar",
  "+ Ajuste Manual", "Exportar").
- **KPI cards**: tarjeta con label en MAYÚSCULA + mini-ícono de gráfico arriba a la derecha, número grande,
  subtítulo, y a veces tendencia ("-31.2% vs ayer"). Aparecen en grillas de 3–4 columnas.
- **Tablas**: header con columnas en mayúscula, filas con acciones (íconos) a la derecha.
- **Footer/statusbar** global: módulo actual · badge "● CAJA ABIERTA" · usuario ("Gaston · Dueño") ·
  íconos de notificaciones/sonido/etc.
- Íconos: set tipo **Lucide/Feather** (line icons).
- Tipografía sans-serif (Inter o similar). Números tabulares para dinero.
- Estados de carga con logo animado "K" y texto "Cargando módulo…".

Ver capturas en `/capturas/` para referencia pixel a pixel de: home, inventario, estadísticas.

---

## 3. Navegación / mapa de módulos

31 rutas hash (`#/ruta`). Estructura del menú (56 ítems y subítems detectados):

- **Inicio** (`#/home`) — dashboard con KPIs del día (Ventas hoy, Ganancia bruta, etc.)
- **Punto de Venta** (`#/pos`) — POS / caja registradora (el corazón del sistema)
- **Kubobots** (`#/kubobots`) — gamificación/fidelización (misiones, recompensas, canjes, ligas)
- **Productos** (`#/productos`) ▾
  - Aumentos de precios (`#/productos/aumentos`)
  - Historial de aumentos (`#/productos/historial`)
  - Listado de productos (`#/productos/listado`)
  - Combos y Packs (`#/productos/combos`)
- **Prod. Universal** (`#/productos-universal`) — catálogo maestro compartido de productos
- **Inventario** (`#/inventario`) ▾
  - Ranking rentabilidad (`#/inventario/ranking`)
  - Estado del inventario (`#/inventario/stock`)
- **Depósito** (`#/deposito`) — stock por depósito/contenedores, hoja de ruta
- **Etiquetas** (`#/etiquetas`) — impresión de etiquetas/códigos de barras
- **Ventas** (`#/ventas`) ▾
  - Historial de ventas
  - Tickets
- **Presupuestos** (`#/presupuestos`)
- **Estadísticas** (`#/estadisticas`) ▾ — panel con filtros (fechas, vendedor, categoría, método de cobro,
  proveedor) y KPIs (Ingresos, Egresos, Balance, Margen, Ticket promedio, Cantidad de ventas)
  - Rankings, Rentabilidad, Mapa Neural (heatmaps de UI)
- **Verdad del Negocio** (`#/verdad-del-negocio`) — dashboard de "números reales" del negocio
- **Control Fiscal** (`#/control-fiscal`) — cola fiscal, CAE, IVA
- **CRM** (`#/crm`) — leads, cuentas corrientes de clientes
- **Facturación** (`#/facturacion`) — emisión de facturas electrónicas AFIP/ARCA
- **Baldes** (`#/baldes`) — módulo específico de heladería (control de baldes)
- **Finanzas** (`#/finanzas`) — flujo de caja, gastos, cuentas y cajas
- **Admin** (`#/admin`) — Panel Admin SaaS (multi-comercio, balance SaaS, error logs, suscripciones)
- **Empleados** (`#/empleados`) — turnos programados, calendario
- **Proveedores** (`#/proveedores`) — proveedores y sus movimientos/saldos
- **Pedidos** (`#/pedidos`) — pedidos a proveedores / catálogo de pedidos
- **Compras** (`#/compras`) — compras a proveedores, facturas de proveedor
- **Caja** (`#/caja`) — Control de caja: aperturas/cierres, mi caja, movimientos
- **Clientes** (`#/clientes`) — gestión de clientes, asignaciones
- **Config** (`#/config`) — datos del comercio, apariencia, IVA y fiscal, usuarios, respaldo

Otras secciones vistas en menús: Cuentas Corrientes, Cuentas y Cajas, Flujo de Caja, Resumen,
Movimientos, Gastos, Historial sesiones, Historial compras, Turnos programados, WhatsApp (integración).

---

## 4. Modelo de datos (Supabase / Postgres)

55 tablas/vistas/funciones detectadas por tráfico real. Las columnas listadas son las **observadas** en los
`select` y filtros — no es exhaustivo, pero es la base fiel. Todas las tablas de negocio llevan `comercio_id`
(multi-tenant) + típicamente `id` (uuid), `created_at`, `updated_at`, `activo`.

> **Regla de oro multi-tenant:** cada tabla debe tener RLS que filtre por `comercio_id` del usuario
> autenticado. El frontend original manda `comercio_id=eq.<uuid>` en cada query.

### 4.1 Núcleo comercial

**`productos`** — la tabla central. Columnas observadas:
`id, comercio_id, codigo_barras, nombre, descripcion, precio_costo, precio_venta, alicuota_iva, stock,
stock_minimo, stock_bajo, stock_reservado, stock_deposito, activo, categoria, subcategoria, proveedor_id,
venta_por_peso, unidad_medida, fecha_vencimiento, precio_oferta, oferta_activa, fecha_inicio_oferta,
fecha_fin_oferta, pasillo, estante, plu_balanza, imagen_url, destacado, novedad, sync_source_id,
modelo_id, modelo_nombre, talle, talle_orden, color, created_at, updated_at`
(Soporta venta por peso/balanza, ofertas con vigencia, indumentaria con modelo/talle/color, ubicación física.)

**`productos_universal`** — catálogo maestro global (no por comercio): `id, codigo_barras, nombre,
descripcion, categoria, marca, verificado, activo`. Para autocompletar altas por código de barras.

**`categorias_productos`** / **`subcategorias_productos`** — `nombre, orden, activa, comercio_id`.
**`product_groups`** — agrupaciones. **`listas_precios`** — listas de precios múltiples.
**`descuentos_cantidad`** — descuentos por cantidad. **`ajustes_precios`** — historial de aumentos masivos.

**`combos`** / **`combo_items`** — combos y packs. `combo_items` referencia `productos`.

### 4.2 Ventas y caja

**`ventas`**: `id, numero_ticket, created_at, total, metodo_pago, monto_efectivo, monto_tarjeta,
monto_transferencia, efectivo_recibido, vuelto, anulada, motivo_anulacion, fecha_anulacion, vendedor_id,
cliente_id, caja_sesion_id, cuenta_pago_id, descuento, recargo_monto, comision_monto, origen,
facturado, cae, cae_vencimiento, tipo_factura, fecha_facturacion, numero_factura, punto_venta_factura,
comprador_fiscal, comprador_datos, excluir_fiscal`

**`ventas_items`**: `venta_id, producto_id, combo_id, cantidad, precio_unitario, costo_unitario,
subtotal, peso_kg, created_at` (join a `productos` y `combos`).

**`cajas_sesiones`**: `id, comercio_id, cajero_id, estado (abierta|cerrada), fecha_apertura, ...`
**`cajas_movimientos`**: `comercio_id, sesion_id, created_at, ...` (ingresos/egresos de caja).
**`cuentas_pago`** — cuentas/medios de cobro (efectivo, tarjeta, MP, transferencia) con comisiones.

### 4.3 Clientes / CRM / fidelización

**`clientes`**: `id, nombre, telefono, celular, tipo, activo, comercio_id, saldo_actual, limite_credito,
kubobots_fid_off`. **`clientes_asignaciones`** — asignación de clientes a vendedores.
**`crm_leads`** — leads de CRM.

**Kubobots** (gamificación/fidelización): `kubobots_bot`, `kubobots_cliente` (puntos, `puntos_historicos`),
`kubobots_mision`, `kubobots_recompensa`, `kubobots_canje`, `kubobots_solicitud`, `kubopet_leaderboard`
(`alias, liga, score, opt_in`). Config en `comercios`: `kubobots_empleados_enabled`,
`kubobots_clientes_enabled`, `kubobots_fid_tasa`.

### 4.4 Inventario / depósito

**`depositos`**: `id, nombre, direccion, activo, comercio_id`.
**`stock_deposito`**: `deposito_id, producto_id, stock`. **`baldes_heladeria`** — módulo heladería.

### 4.5 Proveedores / compras / pedidos

**`proveedores`**: `id, nombre, cuit, contacto, telefono, email, direccion, categoria, condicion_pago,
notas, activo, saldo_actual, instrucciones_parseo` (parseo automático de facturas de proveedor).
**`proveedores_movimientos`** — cuenta corriente de proveedores.
**`compras`**: `id, fecha, total, pagado, proveedor_id, numero_factura, comercio_id`.
**`facturas_proveedores`** (join a `proveedores`). **`pedidos_catalogo`**, **`pedidos_manuales`**.

### 4.6 Finanzas

**`gastos`**: `id, fecha, categoria, descripcion, monto, comercio_id`.
**`consumos_internos`** (+ `consumos_internos_items`) — consumo interno de mercadería
(`persona, tipo_precio, total_costo`).
**`presupuestos`** (+ `presupuestos_items`) — presupuestos/cotizaciones.

### 4.7 Fiscal (AFIP/ARCA)

**`comercios_fiscal_config`** / **`comercios_fiscal_config_publica`** — config de facturación (CUIT, punto
de venta, certificados), con `es_principal`. **`fiscal_queue`**: `id, venta_id, status, batch_id, cae,
cae_vencimiento, punto_venta, numero_factura, tipo_comprobante`. **`fiscal_batches`** — lotes de envío.
**`v_fiscal_uso`** — vista de uso fiscal.

### 4.8 Plataforma / SaaS / admin

**`comercios`** — el tenant (nombre, flags de features, bloqueo: `bloqueado, bloqueado_motivo`).
**`perfiles`**: `id, nombre_completo, rol (Dueño|Cajero|...), activo, comercio_id`.
**`usuarios_comercios`** — relación usuario↔comercio↔rol (multi-comercio por usuario).
**`comercio_dispositivos`** — dispositivos registrados. **`comercio_sync_config`** — config de sincronización.
**`empleados_turnos`** — turnos programados. **`audit_log`** — auditoría (POST). **`error_logs`** — captura de
errores del front (`tipo, mensaje, stack, url, modulo, user_agent`). **`alertas_leidas`** — alertas leídas.
**`ui_events`** / **`ui_heatmaps`** — telemetría de uso de la interfaz (heatmaps del "Mapa Neural").

### 4.9 Funciones RPC (Postgres) detectadas

`get_top_products`, `get_productos_last_updated`, `get_suscripcion_actual`,
`kubobots_mision_pendientes`, `kubobots_misiones_estado`, `kubobots_stock_pendientes`,
`registrar_dispositivo`, `admin_fiscal_dashboard`, `admin_fiscal_series`, `admin_get_balance_saas`,
`admin_get_error_logs`, `admin_list_comercios`.

> El listado completo de columnas por tabla está en `_tables.md`. El SQL de arranque en `schema_inicial.sql`.

---

## 5. Endpoints / patrones de API

- **Base**: `https://<PROJECT>.supabase.co/rest/v1/<tabla>`
- **Auth**: header `apikey` + `Authorization: Bearer <jwt>`. Login por `/auth/v1/token?grant_type=password`.
- **Filtros PostgREST**: `?comercio_id=eq.<uuid>&activo=eq.true&order=nombre.asc&select=...`
- **Joins embebidos**: `select=*,proveedores(nombre)` / `select=*,productos:producto_id(...)`.
- **RPC**: `POST /rest/v1/rpc/<funcion>` con body JSON de parámetros.
- **Storage**: imágenes de productos en bucket público `productos/<comercio_id>/<uuid>.jpg`.
- **Realtime**: el estado "● Conectado / CAJA ABIERTA" sugiere suscripciones realtime (Supabase channels)
  para caja, ventas y stock en vivo. Confirmar y replicar.

El detalle crudo está en `api_urls.txt` (URLs únicas) y `api_calls.json` (710 requests con método).

---

## 6. Mejoras propuestas (el "y mejorar")

Sugerencias priorizadas para superar al original, sin cambiar lo que funciona:

**UX / rendimiento**
1. **Eliminar el "Cargando módulo…" perceptible**: precargar módulos y cachear datos maestros
   (productos, categorías, clientes) en memoria/IndexedDB; hidratar la UI al instante y refrescar en background.
2. **Modo offline real (PWA)**: el POS debe seguir vendiendo sin internet y sincronizar al reconectar
   (cola de ventas local → `sync`). Crítico para comercios con conexión inestable.
3. **Búsqueda de productos instantánea** en el POS (índice local, fuzzy, por código/nombre/PLU), con soporte
   de lector de código de barras y balanza sin latencia de red.
4. **Accesibilidad y tema claro** opcional; foco visible; navegación 100% por teclado en el POS.

**Datos / negocio**
5. **"Verdad del Negocio" reforzada**: márgenes reales (costo con IVA opcional), rentabilidad por
   categoría/proveedor/hora, y comparativas vs período anterior ya insinuadas en los KPIs.
6. **Alertas proactivas**: stock bajo, vencimientos próximos (`fecha_vencimiento`), CAE por vencer,
   diferencias de arqueo de caja.
7. **Auditoría e integridad**: mantener `audit_log` completo y `error_logs`; nunca borrar ventas (usar
   `anulada` + motivo, ya presente).

**Arquitectura**
8. Mantener multi-tenant con **RLS estricto por `comercio_id`** desde el día 1 (no confiar solo en el filtro
   del cliente).
9. Consolidar la lógica fiscal en RPC/Edge Functions (no en el cliente) por seguridad de certificados AFIP.
10. Tests de los flujos críticos: venta completa, cierre de caja/arqueo, emisión de CAE, aumento masivo de precios.

> Confirmá con el usuario cuáles de estas mejoras entran en alcance antes de implementarlas.

---

## 7. Riesgos / cosas a validar con el usuario

- **Facturación AFIP/ARCA** es el punto más delicado (certificados, homologación, CAE). Definir si se
  integra de verdad o se mockea en esta etapa.
- No tenemos el **esquema exacto** (tipos, FKs, constraints, triggers, RLS) — está inferido. Si el usuario
  tiene acceso al proyecto Supabase original, exportar el schema real es la fuente de verdad.
- `comercio_id` usado en el análisis (`a6a91020-...`) es de un comercio real: **no reutilizar** datos reales.
- Integración de **WhatsApp** vista en el menú: aclarar proveedor (API oficial, etc.).
