### `ajustes_precios`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `alertas_leidas`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `audit_log`  _(métodos observados: POST)_

### `baldes_heladeria`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `cajas_movimientos`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`, `created_at`, `sesion_id`

### `cajas_sesiones`  _(métodos observados: GET)_
Columnas observadas: `cajero_id`, `comercio_id`, `estado`, `fecha_apertura`

### `categorias_productos`  _(métodos observados: GET)_
Columnas observadas: `activa`, `comercio_id`, `nombre`

### `clientes`  _(métodos observados: GET)_
Columnas observadas: `activo`, `celular`, `comercio_id`, `id`, `kubobots_fid_off`, `limite_credito`, `nombre`, `saldo_actual`, `telefono`, `tipo`

### `clientes_asignaciones`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`

### `combo_items`  _(métodos observados: GET)_
Relaciones (joins): `productos`

### `combos`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`

### `comercio_dispositivos`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`, `device_id`, `ultima_vez`

### `comercio_sync_config`  _(métodos observados: GET)_

### `comercios`  _(métodos observados: GET)_
Columnas observadas: `bloqueado`, `bloqueado_motivo`, `id`, `kubobots_clientes_enabled`, `kubobots_empleados_enabled`, `kubobots_fid_tasa`

### `comercios_fiscal_config`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`

### `comercios_fiscal_config_publica`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`

### `compras`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`, `fecha`, `id`, `numero_factura`, `pagado`, `proveedor_id`, `total`

### `consumos_internos`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`, `fecha`, `id`, `persona`, `persona_id`, `tipo_precio`, `total_costo`
Relaciones (joins): `consumos_internos_items`

### `crm_leads`  _(métodos observados: GET)_

### `cuentas_pago`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`

### `depositos`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`, `direccion`, `id`, `nombre`

### `descuentos_cantidad`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`

### `empleados_turnos`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`, `fecha`

### `error_logs`  _(métodos observados: POST)_
Columnas observadas: `columns`

### `facturas_proveedores`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`
Relaciones (joins): `proveedores`

### `fiscal_batches`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `fiscal_queue`  _(métodos observados: GET)_
Columnas observadas: `batch_id`, `cae`, `cae_vencimiento`, `comercio_id`, `id`, `numero_factura`, `punto_venta`, `status`, `tipo_comprobante`, `venta_id`

### `gastos`  _(métodos observados: GET)_
Columnas observadas: `categoria`, `comercio_id`, `descripcion`, `fecha`, `id`, `monto`

### `kubobots_bot`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`, `id`

### `kubobots_canje`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `kubobots_cliente`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `kubobots_mision`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `kubobots_recompensa`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `kubobots_solicitud`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `kubopet_leaderboard`  _(métodos observados: GET)_
Columnas observadas: `alias`, `comercio_id`, `liga`, `opt_in`, `score`

### `listas_precios`  _(métodos observados: GET)_
Columnas observadas: `activo`, `comercio_id`

### `pedidos_catalogo`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `pedidos_manuales`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `perfiles`  _(métodos observados: GET,HEAD,PATCH)_
Columnas observadas: `activo`, `comercio_id`, `id`, `nombre_completo`, `rol`
Relaciones (joins): `comercios`

### `presupuestos`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `presupuestos_items`  _(métodos observados: GET)_
Columnas observadas: `presupuesto_id`

### `product_groups`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `productos`  _(métodos observados: GET)_
Columnas observadas: `activo`, `alicuota_iva`, `categoria`, `codigo_barras`, `color`, `comercio_id`, `created_at`, `descripcion`, `destacado`, `estante`, `fecha_fin_oferta`, `fecha_inicio_oferta`, `fecha_vencimiento`, `id`, `imagen_url`, `modelo_id`, `modelo_nombre`, `nombre`, `novedad`, `oferta_activa`, `pasillo`, `plu_balanza`, `precio_costo`, `precio_oferta`, `precio_venta`, `proveedor_id`, `stock`, `stock_bajo`, `stock_deposito`, `stock_minimo`, `stock_reservado`, `subcategoria`, `sync_source_id`, `talle`, `talle_orden`, `unidad_medida`, `updated_at`, `venta_por_peso`

### `productos_universal`  _(métodos observados: GET)_
Columnas observadas: `activo`, `categoria`, `codigo_barras`, `descripcion`, `id`, `marca`, `nombre`, `verificado`

### `proveedores`  _(métodos observados: GET)_
Columnas observadas: `activo`, `categoria`, `comercio_id`, `condicion_pago`, `contacto`, `cuit`, `direccion`, `email`, `id`, `instrucciones_parseo`, `nombre`, `notas`, `saldo_actual`, `telefono`, `updated_at`

### `proveedores_movimientos`  _(métodos observados: GET)_

### `rpc`  _(métodos observados: POST)_

### `stock_deposito`  _(métodos observados: GET)_
Columnas observadas: `deposito_id`, `producto_id`, `stock`

### `subcategorias_productos`  _(métodos observados: GET)_
Columnas observadas: `activa`, `comercio_id`, `nombre`

### `ui_events`  _(métodos observados: GET)_
Columnas observadas: `created_at`, `elemento`, `modulo`, `x`, `y`

### `ui_heatmaps`  _(métodos observados: GET)_
Columnas observadas: `fecha`, `grid`, `modulo`, `sesion_count`, `viewport_h`, `viewport_w`

### `usuarios_comercios`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`, `rol`, `user_id`
Relaciones (joins): `comercios`

### `v_fiscal_uso`  _(métodos observados: GET)_
Columnas observadas: `comercio_id`

### `ventas`  _(métodos observados: GET)_
Columnas observadas: `anulada`, `cae`, `cae_vencimiento`, `caja_sesion_id`, `cliente_id`, `comercio_id`, `comision_monto`, `comprador_datos`, `comprador_fiscal`, `created_at`, `cuenta_pago_id`, `descuento`, `efectivo_recibido`, `excluir_fiscal`, `facturado`, `fecha_anulacion`, `fecha_facturacion`, `id`, `metodo_pago`, `monto_efectivo`, `monto_tarjeta`, `monto_transferencia`, `motivo_anulacion`, `numero_factura`, `numero_ticket`, `origen`, `punto_venta_factura`, `recargo_monto`, `tipo_factura`, `total`, `vendedor_id`, `vuelto`
Relaciones (joins): `ventas_items`

### `ventas_items`  _(métodos observados: GET)_
Columnas observadas: `cantidad`, `combo_id`, `costo_unitario`, `created_at`, `peso_kg`, `precio_unitario`, `producto_id`, `subtotal`, `venta_id`
Relaciones (joins): `combos`, `productos`
