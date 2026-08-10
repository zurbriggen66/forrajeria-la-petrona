-- schema_inicial.sql — DDL de arranque INFERIDO para Kubo Gestión v2.0
-- Generado por ingeniería inversa del tráfico observado. Tipos/constraints APROXIMADOS: revisar.
-- Ejecutar en Supabase. Falta: PKs/FKs formales, defaults, índices, RLS (agregar por comercio_id).

create extension if not exists "pgcrypto";

create table if not exists ajustes_precios (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table ajustes_precios enable row level security;

create table if not exists alertas_leidas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table alertas_leidas enable row level security;

create table if not exists baldes_heladeria (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table baldes_heladeria enable row level security;

create table if not exists cajas_movimientos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  created_at timestamptz default now(),
  sesion_id uuid
);
alter table cajas_movimientos enable row level security;

create table if not exists cajas_sesiones (
  id uuid primary key default gen_random_uuid(),
  cajero_id uuid,
  comercio_id uuid not null,
  estado text,
  fecha_apertura timestamptz
);
alter table cajas_sesiones enable row level security;

create table if not exists categorias_productos (
  id uuid primary key default gen_random_uuid(),
  activa boolean,
  comercio_id uuid not null,
  nombre text
);
alter table categorias_productos enable row level security;

create table if not exists clientes (
  activo boolean,
  celular text,
  comercio_id uuid not null,
  id uuid primary key default gen_random_uuid(),
  kubobots_fid_off boolean,
  limite_credito numeric,
  nombre text,
  saldo_actual numeric,
  telefono text,
  tipo text
);
alter table clientes enable row level security;

create table if not exists clientes_asignaciones (
  id uuid primary key default gen_random_uuid(),
  activo boolean,
  comercio_id uuid not null
);
alter table clientes_asignaciones enable row level security;

create table if not exists combo_items (
  id uuid primary key default gen_random_uuid()
);

create table if not exists combos (
  id uuid primary key default gen_random_uuid(),
  activo boolean,
  comercio_id uuid not null
);
alter table combos enable row level security;

create table if not exists comercio_dispositivos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  device_id uuid,
  ultima_vez timestamptz
);
alter table comercio_dispositivos enable row level security;

create table if not exists comercio_sync_config (
  id uuid primary key default gen_random_uuid()
);

create table if not exists comercios (
  bloqueado boolean,
  bloqueado_motivo text,
  id uuid primary key default gen_random_uuid(),
  kubobots_clientes_enabled boolean,
  kubobots_empleados_enabled boolean,
  kubobots_fid_tasa numeric
);

create table if not exists comercios_fiscal_config (
  id uuid primary key default gen_random_uuid(),
  activo boolean,
  comercio_id uuid not null
);
alter table comercios_fiscal_config enable row level security;

create table if not exists comercios_fiscal_config_publica (
  id uuid primary key default gen_random_uuid(),
  activo boolean,
  comercio_id uuid not null
);
alter table comercios_fiscal_config_publica enable row level security;

create table if not exists compras (
  comercio_id uuid not null,
  fecha timestamptz,
  id uuid primary key default gen_random_uuid(),
  numero_factura text,
  pagado boolean,
  proveedor_id uuid,
  total numeric
);
alter table compras enable row level security;

create table if not exists consumos_internos (
  comercio_id uuid not null,
  fecha timestamptz,
  id uuid primary key default gen_random_uuid(),
  persona text,
  persona_id uuid,
  tipo_precio text,
  total_costo numeric
);
alter table consumos_internos enable row level security;

create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid()
);

create table if not exists cuentas_pago (
  id uuid primary key default gen_random_uuid(),
  activo boolean,
  comercio_id uuid not null
);
alter table cuentas_pago enable row level security;

create table if not exists depositos (
  activo boolean,
  comercio_id uuid not null,
  direccion text,
  id uuid primary key default gen_random_uuid(),
  nombre text
);
alter table depositos enable row level security;

create table if not exists descuentos_cantidad (
  id uuid primary key default gen_random_uuid(),
  activo boolean,
  comercio_id uuid not null
);
alter table descuentos_cantidad enable row level security;

create table if not exists empleados_turnos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  fecha timestamptz
);
alter table empleados_turnos enable row level security;

create table if not exists facturas_proveedores (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table facturas_proveedores enable row level security;

create table if not exists fiscal_batches (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table fiscal_batches enable row level security;

create table if not exists fiscal_queue (
  batch_id uuid,
  cae text,
  cae_vencimiento timestamptz,
  comercio_id uuid not null,
  id uuid primary key default gen_random_uuid(),
  numero_factura text,
  punto_venta text,
  status text,
  tipo_comprobante text,
  venta_id uuid
);
alter table fiscal_queue enable row level security;

create table if not exists gastos (
  categoria text,
  comercio_id uuid not null,
  descripcion text,
  fecha timestamptz,
  id uuid primary key default gen_random_uuid(),
  monto numeric
);
alter table gastos enable row level security;

create table if not exists kubobots_bot (
  comercio_id uuid not null,
  id uuid primary key default gen_random_uuid()
);
alter table kubobots_bot enable row level security;

create table if not exists kubobots_canje (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table kubobots_canje enable row level security;

create table if not exists kubobots_cliente (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table kubobots_cliente enable row level security;

create table if not exists kubobots_mision (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table kubobots_mision enable row level security;

create table if not exists kubobots_recompensa (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table kubobots_recompensa enable row level security;

create table if not exists kubobots_solicitud (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table kubobots_solicitud enable row level security;

create table if not exists kubopet_leaderboard (
  id uuid primary key default gen_random_uuid(),
  alias text,
  comercio_id uuid not null,
  liga text,
  opt_in boolean,
  score numeric
);
alter table kubopet_leaderboard enable row level security;

create table if not exists listas_precios (
  id uuid primary key default gen_random_uuid(),
  activo boolean,
  comercio_id uuid not null
);
alter table listas_precios enable row level security;

create table if not exists pedidos_catalogo (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table pedidos_catalogo enable row level security;

create table if not exists pedidos_manuales (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table pedidos_manuales enable row level security;

create table if not exists perfiles (
  activo boolean,
  comercio_id uuid not null,
  id uuid primary key default gen_random_uuid(),
  nombre_completo text,
  rol text
);
alter table perfiles enable row level security;

create table if not exists presupuestos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table presupuestos enable row level security;

create table if not exists presupuestos_items (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid
);

create table if not exists product_groups (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table product_groups enable row level security;

create table if not exists productos (
  activo boolean,
  alicuota_iva numeric,
  categoria text,
  codigo_barras text,
  color text,
  comercio_id uuid not null,
  created_at timestamptz default now(),
  descripcion text,
  destacado boolean,
  estante text,
  fecha_fin_oferta timestamptz,
  fecha_inicio_oferta timestamptz,
  fecha_vencimiento timestamptz,
  id uuid primary key default gen_random_uuid(),
  imagen_url text,
  modelo_id uuid,
  modelo_nombre text,
  nombre text,
  novedad boolean,
  oferta_activa boolean,
  pasillo text,
  plu_balanza text,
  precio_costo numeric,
  precio_oferta numeric,
  precio_venta numeric,
  proveedor_id uuid,
  stock numeric,
  stock_bajo text,
  stock_deposito numeric,
  stock_minimo numeric,
  stock_reservado numeric,
  subcategoria text,
  sync_source_id uuid,
  talle text,
  talle_orden text,
  unidad_medida text,
  updated_at timestamptz default now(),
  venta_por_peso boolean
);
alter table productos enable row level security;

create table if not exists productos_universal (
  activo boolean,
  categoria text,
  codigo_barras text,
  descripcion text,
  id uuid primary key default gen_random_uuid(),
  marca text,
  nombre text,
  verificado boolean
);

create table if not exists proveedores (
  activo boolean,
  categoria text,
  comercio_id uuid not null,
  condicion_pago text,
  contacto text,
  cuit text,
  direccion text,
  email text,
  id uuid primary key default gen_random_uuid(),
  instrucciones_parseo text,
  nombre text,
  notas text,
  saldo_actual numeric,
  telefono text,
  updated_at timestamptz default now()
);
alter table proveedores enable row level security;

create table if not exists proveedores_movimientos (
  id uuid primary key default gen_random_uuid()
);

create table if not exists stock_deposito (
  id uuid primary key default gen_random_uuid(),
  deposito_id uuid,
  producto_id uuid,
  stock numeric
);

create table if not exists subcategorias_productos (
  id uuid primary key default gen_random_uuid(),
  activa boolean,
  comercio_id uuid not null,
  nombre text
);
alter table subcategorias_productos enable row level security;

create table if not exists ui_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  elemento text,
  modulo text,
  x text,
  y text
);

create table if not exists ui_heatmaps (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz,
  grid text,
  modulo text,
  sesion_count text,
  viewport_h text,
  viewport_w text
);

create table if not exists usuarios_comercios (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  rol text,
  user_id uuid
);
alter table usuarios_comercios enable row level security;

create table if not exists v_fiscal_uso (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null
);
alter table v_fiscal_uso enable row level security;

create table if not exists ventas (
  anulada boolean,
  cae text,
  cae_vencimiento timestamptz,
  caja_sesion_id uuid,
  cliente_id uuid,
  comercio_id uuid not null,
  comision_monto numeric,
  comprador_datos text,
  comprador_fiscal text,
  created_at timestamptz default now(),
  cuenta_pago_id uuid,
  descuento numeric,
  efectivo_recibido numeric,
  excluir_fiscal boolean,
  facturado boolean,
  fecha_anulacion timestamptz,
  fecha_facturacion timestamptz,
  id uuid primary key default gen_random_uuid(),
  metodo_pago text,
  monto_efectivo numeric,
  monto_tarjeta numeric,
  monto_transferencia numeric,
  motivo_anulacion text,
  numero_factura text,
  numero_ticket text,
  origen text,
  punto_venta_factura text,
  recargo_monto numeric,
  tipo_factura text,
  total numeric,
  vendedor_id uuid,
  vuelto numeric
);
alter table ventas enable row level security;

create table if not exists ventas_items (
  id uuid primary key default gen_random_uuid(),
  cantidad numeric,
  combo_id uuid,
  costo_unitario numeric,
  created_at timestamptz default now(),
  peso_kg numeric,
  precio_unitario numeric,
  producto_id uuid,
  subtotal numeric,
  venta_id uuid
);
