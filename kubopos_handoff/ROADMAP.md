# ROADMAP — Reconstrucción de Kubo Gestión v2.0

Plan por fases para Claude Code. Cada fase es entregable y verificable. No avanzar a la siguiente
sin cerrar los criterios de aceptación de la actual.

## Fase 0 — Cimientos (setup)
- Inicializar el repo con el stack elegido (ver `CLAUDE.md`).
- Crear proyecto Supabase; aplicar `schema_inicial.sql`; activar RLS por `comercio_id`.
- Auth (login por email/password), sesión persistente, guard de rutas.
- Shell de la app: sidebar colapsable + topbar por módulo + statusbar (usuario, "CAJA ABIERTA", conexión).
- Sistema de diseño: tokens de color, tipografía, componentes base (KPI card, tabla, botones, inputs, toast).
- Seed de datos ficticios (1 comercio demo, productos, categorías, 1 usuario "Dueño").
- **Aceptación:** login funciona, se ve el shell con navegación y datos demo; RLS impide ver otro comercio.

## Fase 1 — Productos + Inventario (núcleo de catálogo)
- CRUD de `productos` (alta con código de barras que autocompleta desde `productos_universal`).
- Categorías/subcategorías, listas de precios, combos y packs.
- Estado del inventario (stock actual/mínimo, valorizado, filtros Todos/Stock Bajo/Sin Stock).
- Ranking de rentabilidad (`get_top_products`).
- Aumentos de precios masivos + historial (`ajustes_precios`).
- **Aceptación:** se cargan productos, se ve el inventario con KPIs reales, se aplica un aumento y queda en historial.

## Fase 2 — Punto de Venta (POS) ⭐ el corazón
- Búsqueda instantánea (código/nombre/PLU), lector de código de barras, venta por peso/balanza.
- Carrito, descuentos/recargos, múltiples medios de pago (`cuentas_pago`), vuelto.
- Registrar `ventas` + `ventas_items`, descontar stock, número de ticket.
- Selección de cliente y aplicación de fidelización (Kubobots) si está activa.
- **Offline-first**: vender sin conexión y sincronizar al reconectar.
- **Aceptación:** venta completa de punta a punta, stock actualizado, ticket generado; funciona offline.

## Fase 3 — Caja y Finanzas
- Apertura/cierre de caja (`cajas_sesiones`), movimientos, arqueo con diferencias.
- Gastos, consumos internos, cuentas y cajas, flujo de caja.
- **Aceptación:** abrir caja, vender, registrar gasto, cerrar caja con arqueo correcto.

## Fase 4 — Ventas, Estadísticas y "Verdad del Negocio"
- Historial de ventas, tickets, anulaciones (con motivo, sin borrar).
- Panel de estadísticas con filtros (fechas, vendedor, categoría, método, proveedor) y KPIs
  (ingresos, egresos, balance, margen, ticket promedio, cantidad).
- "Verdad del Negocio": rentabilidad real por categoría/proveedor/hora + comparativas de período.
- **Aceptación:** los KPIs cuadran con las ventas registradas; filtros funcionan.

## Fase 5 — Proveedores, Compras, Pedidos, Depósito
- Proveedores con cuenta corriente y saldos; compras y facturas de proveedor.
- Pedidos (catálogo y manuales), pedidos sugeridos por stock.
- Depósitos y `stock_deposito`, hoja de ruta.
- **Aceptación:** registrar una compra actualiza stock y saldo del proveedor.

## Fase 6 — Clientes, CRM y Kubobots
- Clientes (cuenta corriente, límite de crédito), asignaciones, leads CRM.
- Kubobots: misiones, recompensas, canjes, ligas/leaderboard.
- **Aceptación:** una venta suma puntos; se puede canjear una recompensa.

## Fase 7 — Fiscal / Facturación (AFIP/ARCA)
- Config fiscal por comercio, cola fiscal, emisión de CAE, tipos de comprobante, punto de venta.
- **Requiere decisión de alcance**: integración real de homologación AFIP vs. mock. Lógica en el servidor.
- **Aceptación:** una venta genera un comprobante con CAE (real o simulado según alcance).

## Fase 8 — Admin SaaS, Empleados, Config, Etiquetas
- Panel Admin multi-comercio (balance SaaS, error logs, suscripciones, listado de comercios).
- Empleados y turnos, calendario. Etiquetas/códigos de barras. Configuración del comercio, usuarios, respaldo.
- Telemetría de UI (`ui_events`/`ui_heatmaps`) — "Mapa Neural" — opcional.
- **Aceptación:** administración básica del comercio y usuarios operativa.

## Transversal (todas las fases)
- Manejo de errores → `error_logs`; auditoría → `audit_log`.
- Estados de carga/vacío/error en cada vista.
- Tests de regresión de los flujos críticos antes de cerrar cada fase.
