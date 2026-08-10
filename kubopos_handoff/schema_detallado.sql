-- ============================================================================
-- Kubo Gestión v2.0 — schema_detallado.sql
-- DDL para Supabase/Postgres con tipos, claves foráneas, índices y RLS.
-- INFERIDO por ingeniería inversa del tráfico real. Revisar antes de producción.
-- Orden de creación respeta dependencias (padres antes que hijos).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper: comercio_id del usuario autenticado (para políticas RLS).
-- Se apoya en usuarios_comercios (relación user <-> comercio).
-- ----------------------------------------------------------------------------
-- (definida más abajo, después de usuarios_comercios)

-- ============================================================================
-- 1. PLATAFORMA / TENANT / USUARIOS
-- ============================================================================

create table if not exists comercios (
  id                          uuid primary key default gen_random_uuid(),
  nombre                      text not null,
  cuit                        text,
  direccion                   text,
  telefono                    text,
  email                       text,
  logo_url                    text,
  rubro                       text,                       -- kiosco, heladeria, indumentaria...
  activo                      boolean not null default true,
  bloqueado                   boolean not null default false,
  bloqueado_motivo            text,
  -- flags de features (fidelización Kubobots)
  kubobots_empleados_enabled  boolean not null default false,
  kubobots_clientes_enabled   boolean not null default false,
  kubobots_fid_tasa           numeric(10,4) default 0,    -- tasa de acumulación de puntos
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Perfil de usuario (1:1 con auth.users de Supabase). Pertenece a un comercio "principal".
create table if not exists perfiles (
  id                uuid primary key,                     -- = auth.users.id
  comercio_id       uuid references comercios(id) on delete set null,
  nombre_completo   text,
  email             text,
  rol               text not null default 'Cajero',       -- Dueño | Administrador | Cajero | Repositor
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Relación N:M usuario <-> comercio con rol (un usuario puede operar varios comercios).
create table if not exists usuarios_comercios (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,                             -- auth.users.id
  comercio_id  uuid not null references comercios(id) on delete cascade,
  rol          text not null default 'Cajero',
  created_at   timestamptz not null default now(),
  unique (user_id, comercio_id)
);
create index if not exists idx_usuarios_comercios_user on usuarios_comercios(user_id);
create index if not exists idx_usuarios_comercios_com  on usuarios_comercios(comercio_id);

-- Función helper para RLS: ¿pertenece el usuario actual a este comercio?
create or replace function public.pertenece_comercio(cid uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from usuarios_comercios uc
    where uc.comercio_id = cid and uc.user_id = auth.uid()
  );
$$;

create table if not exists comercio_dispositivos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  device_id    text not null,
  nombre       text,
  ultima_vez   timestamptz default now(),
  created_at   timestamptz not null default now(),
  unique (comercio_id, device_id)
);

create table if not exists comercio_sync_config (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  config       jsonb not null default '{}',
  updated_at   timestamptz not null default now()
);

create table if not exists empleados_turnos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  empleado_id  uuid references perfiles(id) on delete set null,
  fecha        date not null,
  hora_inicio  time,
  hora_fin     time,
  notas        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_turnos_com_fecha on empleados_turnos(comercio_id, fecha);

-- ============================================================================
-- 2. CATÁLOGO / PRODUCTOS
-- ============================================================================

create table if not exists categorias_productos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text not null,
  orden        integer default 0,
  activa       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_categorias_com on categorias_productos(comercio_id);

create table if not exists subcategorias_productos (
  id            uuid primary key default gen_random_uuid(),
  comercio_id   uuid not null references comercios(id) on delete cascade,
  categoria_id  uuid references categorias_productos(id) on delete set null,
  nombre        text not null,
  orden         integer default 0,
  activa        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Catálogo maestro GLOBAL (no por comercio): autocompletar por código de barras.
create table if not exists productos_universal (
  id            uuid primary key default gen_random_uuid(),
  codigo_barras text unique,
  nombre        text not null,
  descripcion   text,
  categoria     text,
  marca         text,
  verificado    boolean not null default false,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_prod_univ_codigo on productos_universal(codigo_barras);

-- Proveedores (declarado antes de productos por la FK proveedor_id).
create table if not exists proveedores (
  id                   uuid primary key default gen_random_uuid(),
  comercio_id          uuid not null references comercios(id) on delete cascade,
  nombre               text not null,
  cuit                 text,
  contacto             text,
  telefono             text,
  email                text,
  direccion            text,
  categoria            text,
  condicion_pago       text,
  notas                text,
  saldo_actual         numeric(14,2) not null default 0,
  instrucciones_parseo text,                              -- para parseo automático de facturas
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_proveedores_com on proveedores(comercio_id);

create table if not exists productos (
  id                  uuid primary key default gen_random_uuid(),
  comercio_id         uuid not null references comercios(id) on delete cascade,
  codigo_barras       text,
  nombre              text not null,
  descripcion         text,
  categoria           text,
  subcategoria        text,
  proveedor_id        uuid references proveedores(id) on delete set null,
  precio_costo        numeric(14,2) not null default 0,
  precio_venta        numeric(14,2) not null default 0,
  alicuota_iva        numeric(5,2)  not null default 21,  -- 21 / 10.5 / 0
  -- stock
  stock               numeric(14,3) not null default 0,
  stock_minimo        numeric(14,3) not null default 0,
  stock_reservado     numeric(14,3) not null default 0,
  stock_deposito      numeric(14,3) not null default 0,
  stock_bajo          boolean generated always as (stock <= stock_minimo) stored,
  -- venta por peso / balanza
  venta_por_peso      boolean not null default false,
  unidad_medida       text default 'unidad',              -- unidad | kg | g | lt
  plu_balanza         text,
  -- ofertas con vigencia
  precio_oferta       numeric(14,2),
  oferta_activa       boolean not null default false,
  fecha_inicio_oferta timestamptz,
  fecha_fin_oferta    timestamptz,
  fecha_vencimiento   date,
  -- ubicación física
  pasillo             text,
  estante             text,
  -- indumentaria (variantes)
  modelo_id           uuid,
  modelo_nombre       text,
  talle               text,
  talle_orden         integer,
  color               text,
  -- flags / media
  imagen_url          text,
  destacado           boolean not null default false,
  novedad             boolean not null default false,
  sync_source_id      uuid,                               -- id en productos_universal si vino de ahí
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_productos_com     on productos(comercio_id);
create index if not exists idx_productos_codigo  on productos(comercio_id, codigo_barras);
create index if not exists idx_productos_nombre  on productos(comercio_id, nombre);
create index if not exists idx_productos_activo  on productos(comercio_id, activo);

create table if not exists product_groups (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  created_at   timestamptz not null default now()
);

create table if not exists listas_precios (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  ajuste_pct   numeric(6,2) default 0,                    -- % sobre precio base
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists descuentos_cantidad (
  id             uuid primary key default gen_random_uuid(),
  comercio_id    uuid not null references comercios(id) on delete cascade,
  producto_id    uuid references productos(id) on delete cascade,
  cantidad_min   numeric(14,3) not null,
  descuento_pct  numeric(6,2) not null,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists ajustes_precios (
  id            uuid primary key default gen_random_uuid(),
  comercio_id   uuid not null references comercios(id) on delete cascade,
  descripcion   text,
  tipo          text,                                     -- porcentaje | monto
  valor         numeric(14,2),
  filtro        jsonb,                                    -- categoría/proveedor afectados
  aplicado_por  uuid references perfiles(id) on delete set null,
  cant_productos integer default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ajustes_com on ajustes_precios(comercio_id, created_at desc);

create table if not exists combos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  precio       numeric(14,2) not null default 0,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists combo_items (
  id           uuid primary key default gen_random_uuid(),
  combo_id     uuid not null references combos(id) on delete cascade,
  producto_id  uuid not null references productos(id) on delete cascade,
  cantidad     numeric(14,3) not null default 1,
  created_at   timestamptz not null default now()
);
create index if not exists idx_combo_items_combo on combo_items(combo_id);

-- ============================================================================
-- 3. DEPÓSITOS / STOCK
-- ============================================================================

create table if not exists depositos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text not null,
  direccion    text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists stock_deposito (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  deposito_id  uuid not null references depositos(id) on delete cascade,
  producto_id  uuid not null references productos(id) on delete cascade,
  stock        numeric(14,3) not null default 0,
  unique (deposito_id, producto_id)
);
create index if not exists idx_stock_dep on stock_deposito(deposito_id, producto_id);

create table if not exists baldes_heladeria (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  sabor        text,
  producto_id  uuid references productos(id) on delete set null,
  peso_inicial numeric(14,3),
  peso_actual  numeric(14,3),
  estado       text default 'activo',
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 4. CLIENTES / CRM / FIDELIZACIÓN
-- ============================================================================

create table if not exists clientes (
  id                uuid primary key default gen_random_uuid(),
  comercio_id       uuid not null references comercios(id) on delete cascade,
  nombre            text not null,
  telefono          text,
  celular           text,
  email             text,
  cuit              text,
  direccion         text,
  tipo              text default 'consumidor_final',      -- consumidor_final | responsable_inscripto | ...
  saldo_actual      numeric(14,2) not null default 0,     -- cuenta corriente
  limite_credito    numeric(14,2) not null default 0,
  kubobots_fid_off  boolean not null default false,       -- excluido de fidelización
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_clientes_com on clientes(comercio_id);

create table if not exists clientes_asignaciones (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  cliente_id   uuid not null references clientes(id) on delete cascade,
  vendedor_id  uuid references perfiles(id) on delete set null,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists crm_leads (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid references comercios(id) on delete cascade,
  nombre       text,
  telefono     text,
  email        text,
  estado       text default 'nuevo',
  notas        text,
  created_at   timestamptz not null default now()
);

-- Kubobots (gamificación / fidelización)
create table if not exists kubobots_bot (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text,
  config       jsonb default '{}',
  created_at   timestamptz not null default now()
);
create table if not exists kubobots_cliente (
  id                 uuid primary key default gen_random_uuid(),
  comercio_id        uuid not null references comercios(id) on delete cascade,
  cliente_id         uuid references clientes(id) on delete cascade,
  puntos             numeric(14,2) not null default 0,
  puntos_historicos  numeric(14,2) not null default 0,
  liga               text,
  created_at         timestamptz not null default now()
);
create table if not exists kubobots_mision (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text,
  descripcion  text,
  objetivo     jsonb,
  recompensa   numeric(14,2),
  activa       boolean not null default true,
  created_at   timestamptz not null default now()
);
create table if not exists kubobots_recompensa (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text,
  costo_puntos numeric(14,2),
  activa       boolean not null default true,
  created_at   timestamptz not null default now()
);
create table if not exists kubobots_canje (
  id             uuid primary key default gen_random_uuid(),
  comercio_id    uuid not null references comercios(id) on delete cascade,
  cliente_id     uuid references clientes(id) on delete set null,
  recompensa_id  uuid references kubobots_recompensa(id) on delete set null,
  puntos         numeric(14,2),
  created_at     timestamptz not null default now()
);
create table if not exists kubobots_solicitud (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  tipo         text,
  payload      jsonb,
  estado       text default 'pendiente',
  created_at   timestamptz not null default now()
);
create table if not exists kubopet_leaderboard (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  alias        text,
  liga         text,
  score        numeric(14,2) not null default 0,
  opt_in       boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 5. CAJA / MEDIOS DE PAGO
-- ============================================================================

create table if not exists cuentas_pago (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  nombre       text not null,                             -- Efectivo, Tarjeta, MercadoPago, Transferencia
  tipo         text,
  comision_pct numeric(6,2) not null default 0,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists cajas_sesiones (
  id              uuid primary key default gen_random_uuid(),
  comercio_id     uuid not null references comercios(id) on delete cascade,
  cajero_id       uuid references perfiles(id) on delete set null,
  estado          text not null default 'abierta',        -- abierta | cerrada
  monto_apertura  numeric(14,2) not null default 0,
  monto_cierre    numeric(14,2),
  monto_esperado  numeric(14,2),
  diferencia      numeric(14,2),
  fecha_apertura  timestamptz not null default now(),
  fecha_cierre    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_cajas_com_estado on cajas_sesiones(comercio_id, estado);

create table if not exists cajas_movimientos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  sesion_id    uuid references cajas_sesiones(id) on delete cascade,
  tipo         text not null,                             -- ingreso | egreso
  concepto     text,
  monto        numeric(14,2) not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_cajas_mov on cajas_movimientos(comercio_id, sesion_id, created_at desc);

-- ============================================================================
-- 6. VENTAS
-- ============================================================================

create table if not exists ventas (
  id                   uuid primary key default gen_random_uuid(),
  comercio_id          uuid not null references comercios(id) on delete cascade,
  numero_ticket        bigint,
  vendedor_id          uuid references perfiles(id) on delete set null,
  cliente_id           uuid references clientes(id) on delete set null,
  caja_sesion_id       uuid references cajas_sesiones(id) on delete set null,
  cuenta_pago_id       uuid references cuentas_pago(id) on delete set null,
  total                numeric(14,2) not null default 0,
  descuento            numeric(14,2) not null default 0,
  recargo_monto        numeric(14,2) not null default 0,
  comision_monto       numeric(14,2) not null default 0,
  metodo_pago          text,                              -- efectivo | tarjeta | transferencia | mixto
  monto_efectivo       numeric(14,2) not null default 0,
  monto_tarjeta        numeric(14,2) not null default 0,
  monto_transferencia  numeric(14,2) not null default 0,
  efectivo_recibido    numeric(14,2),
  vuelto               numeric(14,2),
  origen               text default 'pos',
  -- anulación (nunca se borra una venta)
  anulada              boolean not null default false,
  motivo_anulacion     text,
  fecha_anulacion      timestamptz,
  -- fiscal
  facturado            boolean not null default false,
  excluir_fiscal       boolean not null default false,
  cae                  text,
  cae_vencimiento      date,
  tipo_factura         text,                              -- A | B | C
  numero_factura       text,
  punto_venta_factura  text,
  fecha_facturacion    timestamptz,
  comprador_fiscal     text,
  comprador_datos      jsonb,
  created_at           timestamptz not null default now()
);
create index if not exists idx_ventas_com_fecha on ventas(comercio_id, created_at desc);
create index if not exists idx_ventas_sesion    on ventas(caja_sesion_id);
create index if not exists idx_ventas_cliente   on ventas(cliente_id);

create table if not exists ventas_items (
  id               uuid primary key default gen_random_uuid(),
  venta_id         uuid not null references ventas(id) on delete cascade,
  producto_id      uuid references productos(id) on delete set null,
  combo_id         uuid references combos(id) on delete set null,
  cantidad         numeric(14,3) not null default 1,
  peso_kg          numeric(14,3),
  precio_unitario  numeric(14,2) not null default 0,
  costo_unitario   numeric(14,2) not null default 0,
  subtotal         numeric(14,2) not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists idx_ventas_items_venta on ventas_items(venta_id);
create index if not exists idx_ventas_items_prod  on ventas_items(producto_id);

create table if not exists presupuestos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  cliente_id   uuid references clientes(id) on delete set null,
  numero       text,
  total        numeric(14,2) not null default 0,
  estado       text default 'pendiente',
  validez      date,
  created_at   timestamptz not null default now()
);
create table if not exists presupuestos_items (
  id               uuid primary key default gen_random_uuid(),
  presupuesto_id   uuid not null references presupuestos(id) on delete cascade,
  producto_id      uuid references productos(id) on delete set null,
  cantidad         numeric(14,3) not null default 1,
  precio_unitario  numeric(14,2) not null default 0,
  subtotal         numeric(14,2) not null default 0
);

-- ============================================================================
-- 7. COMPRAS / PROVEEDORES / PEDIDOS
-- ============================================================================

create table if not exists compras (
  id             uuid primary key default gen_random_uuid(),
  comercio_id    uuid not null references comercios(id) on delete cascade,
  proveedor_id   uuid references proveedores(id) on delete set null,
  numero_factura text,
  fecha          date not null default current_date,
  total          numeric(14,2) not null default 0,
  pagado         boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_compras_com_fecha on compras(comercio_id, fecha desc);

create table if not exists compras_items (
  id               uuid primary key default gen_random_uuid(),
  compra_id        uuid not null references compras(id) on delete cascade,
  producto_id      uuid references productos(id) on delete set null,
  cantidad         numeric(14,3) not null default 1,
  costo_unitario   numeric(14,2) not null default 0,
  subtotal         numeric(14,2) not null default 0
);

create table if not exists facturas_proveedores (
  id             uuid primary key default gen_random_uuid(),
  comercio_id    uuid not null references comercios(id) on delete cascade,
  proveedor_id   uuid references proveedores(id) on delete set null,
  numero         text,
  total          numeric(14,2) not null default 0,
  fecha          date,
  archivo_url    text,
  parseado       jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists proveedores_movimientos (
  id            uuid primary key default gen_random_uuid(),
  comercio_id   uuid references comercios(id) on delete cascade,
  proveedor_id  uuid not null references proveedores(id) on delete cascade,
  tipo          text,                                     -- compra | pago | ajuste
  monto         numeric(14,2) not null,
  referencia    text,
  created_at    timestamptz not null default now()
);

create table if not exists pedidos_catalogo (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  proveedor_id uuid references proveedores(id) on delete set null,
  datos        jsonb,
  estado       text default 'borrador',
  created_at   timestamptz not null default now()
);
create table if not exists pedidos_manuales (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  detalle      jsonb,
  estado       text default 'pendiente',
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 8. FINANZAS
-- ============================================================================

create table if not exists gastos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  categoria    text,
  descripcion  text,
  monto        numeric(14,2) not null default 0,
  fecha        date not null default current_date,
  created_at   timestamptz not null default now()
);
create index if not exists idx_gastos_com_fecha on gastos(comercio_id, fecha desc);

create table if not exists consumos_internos (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  persona      text,
  persona_id   uuid references perfiles(id) on delete set null,
  tipo_precio  text default 'costo',                      -- costo | venta
  total_costo  numeric(14,2) not null default 0,
  fecha        timestamptz not null default now()
);
create table if not exists consumos_internos_items (
  id               uuid primary key default gen_random_uuid(),
  consumo_id       uuid not null references consumos_internos(id) on delete cascade,
  producto_id      uuid references productos(id) on delete set null,
  nombre_producto  text,
  cantidad         numeric(14,3) not null default 1,
  peso_kg          numeric(14,3),
  unidad_medida    text,
  precio_costo     numeric(14,2),
  precio_venta     numeric(14,2),
  subtotal         numeric(14,2)
);

-- ============================================================================
-- 9. FISCAL (AFIP/ARCA)
-- ============================================================================

create table if not exists comercios_fiscal_config (
  id            uuid primary key default gen_random_uuid(),
  comercio_id   uuid not null references comercios(id) on delete cascade,
  cuit          text,
  razon_social  text,
  punto_venta   text,
  condicion_iva text,
  es_principal  boolean not null default false,
  -- OJO: certificados/keys AFIP NO deben guardarse acá en texto plano.
  -- Usar Supabase Vault / secret manager y una Edge Function para firmar.
  cert_ref      text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
-- Vista pública sin datos sensibles (la usa el front).
-- create view comercios_fiscal_config_publica as
--   select id, comercio_id, punto_venta, condicion_iva, es_principal, activo
--   from comercios_fiscal_config;

create table if not exists fiscal_batches (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  status       text default 'pendiente',
  cantidad     integer default 0,
  created_at   timestamptz not null default now()
);

create table if not exists fiscal_queue (
  id               uuid primary key default gen_random_uuid(),
  comercio_id      uuid not null references comercios(id) on delete cascade,
  venta_id         uuid references ventas(id) on delete cascade,
  batch_id         uuid references fiscal_batches(id) on delete set null,
  status           text default 'pendiente',              -- pendiente | procesando | ok | error
  cae              text,
  cae_vencimiento  date,
  punto_venta      text,
  numero_factura   text,
  tipo_comprobante text,
  error_msg        text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_fiscal_queue on fiscal_queue(comercio_id, status);

-- ============================================================================
-- 10. AUDITORÍA / TELEMETRÍA / SISTEMA
-- ============================================================================

create table if not exists audit_log (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid references comercios(id) on delete cascade,
  user_id      uuid,
  accion       text,
  entidad      text,
  entidad_id   uuid,
  datos        jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_audit_com on audit_log(comercio_id, created_at desc);

create table if not exists error_logs (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid references comercios(id) on delete set null,
  user_id      uuid,
  user_nombre  text,
  tipo         text,
  mensaje      text,
  stack        text,
  url          text,
  linea        integer,
  columna      integer,
  user_agent   text,
  modulo       text,
  created_at   timestamptz not null default now()
);

create table if not exists alertas_leidas (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid not null references comercios(id) on delete cascade,
  user_id      uuid,
  alerta_key   text,
  created_at   timestamptz not null default now()
);

create table if not exists ui_events (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid references comercios(id) on delete cascade,
  modulo       text,
  elemento     text,
  x            integer,
  y            integer,
  created_at   timestamptz not null default now()
);
create index if not exists idx_ui_events on ui_events(modulo, created_at desc);

create table if not exists ui_heatmaps (
  id           uuid primary key default gen_random_uuid(),
  comercio_id  uuid references comercios(id) on delete cascade,
  modulo       text,
  fecha        date,
  viewport_w   integer,
  viewport_h   integer,
  grid         jsonb,
  sesion_count integer default 0
);

-- ============================================================================
-- 11. RLS — políticas por comercio_id
-- Patrón: habilitar RLS y permitir todo al usuario que pertenece al comercio.
-- Ajustar por rol donde haga falta (ej. sólo Dueño ve finanzas).
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'comercios','perfiles','usuarios_comercios','comercio_dispositivos','comercio_sync_config',
    'empleados_turnos','categorias_productos','subcategorias_productos','proveedores','productos',
    'product_groups','listas_precios','descuentos_cantidad','ajustes_precios','combos','combo_items',
    'depositos','stock_deposito','baldes_heladeria','clientes','clientes_asignaciones','crm_leads',
    'kubobots_bot','kubobots_cliente','kubobots_mision','kubobots_recompensa','kubobots_canje',
    'kubobots_solicitud','kubopet_leaderboard','cuentas_pago','cajas_sesiones','cajas_movimientos',
    'ventas','ventas_items','presupuestos','presupuestos_items','compras','compras_items',
    'facturas_proveedores','proveedores_movimientos','pedidos_catalogo','pedidos_manuales','gastos',
    'consumos_internos','consumos_internos_items','comercios_fiscal_config','fiscal_batches',
    'fiscal_queue','audit_log','error_logs','alertas_leidas','ui_events','ui_heatmaps'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Ejemplo de política para una tabla con comercio_id directo (replicar por tabla):
--   create policy com_rw on productos
--     using (public.pertenece_comercio(comercio_id))
--     with check (public.pertenece_comercio(comercio_id));
-- Para tablas hijas sin comercio_id (combo_items, ventas_items, etc.) validar vía el padre.
-- productos_universal es global: política de lectura para todos los autenticados.

-- FIN
