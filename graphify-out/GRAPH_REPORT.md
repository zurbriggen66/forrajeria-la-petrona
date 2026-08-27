# Graph Report - forrajeria-la-petrona  (2026-08-27)

## Corpus Check
- Large corpus: 390 files · ~1,478,235 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2459 nodes · 6085 edges · 211 communities (131 shown, 80 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 322 edges (avg confidence: 0.93)
- Token cost: 110,502 input · 0 output

## Community Hubs (Navigation)
- Facturacion Fiscal ARCA
- Cuenta Corriente Clientes
- Presupuestos e Impresion
- Compras a Proveedores
- Usuarios Roles y Permisos
- Caja y Arqueo
- Inventario y Stock UI
- Componentes UI Base
- Pedidos a Proveedores UI
- Depositos y Stock Backend
- Proveedores Backend
- Precios y Repartos
- Formato y Export CSV
- Catalogo de Productos
- Seed y Tests de Modelos
- Tests de Contabilidad
- API Clientes Frontend
- Asistente IA Modelos
- Formularios y Toasts
- Tests Multi-Tenant Productos
- Compras Backend
- Control de Caja UI
- Tests de Arqueo
- Cliente Claude API
- Tests Core y Sucursales
- API Ventas y Periodos
- Estadisticas y Rankings
- Configuracion y WhatsApp
- Admin SaaS Multi-Sucursal
- Tests Acciones Asistente
- Tabla y Admin UI
- Deploy y Dependencias
- Shell Rutas y Layout
- Tests Bucle Conversacion
- Etiquetas y Combos
- Tests Compra Fiada
- Venta Fraccionada Rationale
- TS Config App
- Asistente UI
- Carrito POS
- Cobro y Cliente POS
- API Inventario Frontend
- TS Config Node
- Serializers Estadisticas
- Bot de WhatsApp
- Pantalla de Inicio
- Cola Offline POS
- Tests Cuenta Corriente
- Tests Descuento por Item
- Deudas por Antiguedad
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167

## God Nodes (most connected - your core abstractions)
1. `formatMoney()` - 107 edges
2. `extraerMensajeError()` - 96 edges
3. `useToast()` - 92 edges
4. `react` - 89 edges
5. `TenantModel` - 63 edges
6. `resolver_comercio_activo()` - 57 edges
7. `Button()` - 56 edges
8. `TenantViewSet` - 45 edges
9. `Producto` - 44 edges
10. `Perfil` - 42 edges

## Surprising Connections (you probably didn't know these)
- `Título de la app: TIENDA-IA` --conceptually_related_to--> `Asistente con IA (anthropic) opcional`  [AMBIGUOUS]
  frontend/index.html → backend/requirements.txt
- `Despliegue VPS de un solo host` --references--> `Dependencias de producción (gunicorn + psycopg)`  [EXTRACTED]
  deploy/README.md → backend/requirements.txt
- `CORS_ALLOWED_ORIGINS para el dominio de Vercel` --shares_data_with--> `Stack Django 6.1 + DRF + SimpleJWT`  [INFERRED]
  deploy/README_PYTHONANYWHERE.md → backend/requirements.txt
- `VITE_API_URL horneado en tiempo de build` --conceptually_related_to--> `Punto de entrada del SPA (index.html)`  [INFERRED]
  deploy/README.md → frontend/index.html
- `Ruteo SPA de React Router en Vercel` --conceptually_related_to--> `Punto de entrada del SPA (index.html)`  [INFERRED]
  deploy/README_PYTHONANYWHERE.md → frontend/index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flujo de carga inicial de datos (dumpdata → scp → loaddata → verificación → borrado)** — deploy_readme_seed_json, deploy_readme_pythonutf8_dumpdata, deploy_readme_checklist_verificacion, deploy_readme_pythonanywhere_checklist_verificacion [EXTRACTED 1.00]
- **Cadena de facturación electrónica Fase 7 (certificados, pyafipws, arranque de la app)** — backend_fiscal_certs_readme_certificados_arca_afip, backend_fiscal_certs_readme_cert_ref, backend_fiscal_certs_readme_wsaa_wsfev1, backend_requirements_pyafipws_git_pin, backend_requirements_setuptools_distutils_shim, deploy_readme_pythonanywhere_pyafipws_import_perezoso [EXTRACTED 1.00]
- **Decisión de topología: un origen (VPS) vs dos orígenes (PA + Vercel)** — deploy_readme_despliegue_vps_single_host, deploy_readme_pythonanywhere_despliegue_pa_vercel, deploy_readme_pythonanywhere_cors_allowed_origins, deploy_readme_vite_api_url_build_time, deploy_readme_pythonanywhere_vercel_spa_routing [EXTRACTED 1.00]
- **Social Platform Icon Row (Bluesky, Discord, GitHub, X)** — frontend_public_icons_bluesky_icon, frontend_public_icons_discord_icon, frontend_public_icons_github_icon, frontend_public_icons_x_icon, frontend_public_icons_ink_fill_08060d [INFERRED 0.85]
- **Violet Outline UI Icon Family** — frontend_public_icons_documentation_icon, frontend_public_icons_social_icon, frontend_public_icons_violet_stroke_style_aa3bff, frontend_public_favicon_violet_brand_palette [INFERRED 0.75]

## Communities (211 total, 80 thin omitted)

### Community 0 - "Facturacion Fiscal ARCA"
Cohesion: 0.06
Nodes (46): ErrorFiscal, _obtener_ticket(), Exception, Wrapper fino sobre pyafipws (WSAA + WSFEv1) para pedir un CAE. Homologación por…, Pide el CAE a WSFEv1 para una Venta ya creada. Devuelve dict con…, Rechazo de ARCA o error de comunicación al pedir un CAE., Token+Sign de WSAA para el CUIT de `config`, cacheados ~11hs (el ticket real…, Simplificado: no consulta el padrón de ARCA para la condición IVA real del… (+38 more)

### Community 1 - "Cuenta Corriente Clientes"
Cohesion: 0.06
Nodes (41): Cliente, ClienteMovimiento, Cuenta corriente del cliente: ventas 'fiadas' (cargo) y pagos que hace para…, Cuenta corriente de clientes, asignaciones a vendedor y leads CRM (Fase 6).…, Aislamiento multi-tenant por comercio, resuelto SIEMPRE en el backend (nunca…, Gestión contable: los números del negocio con criterio contable. La distinción…, Meta, Presupuesto (+33 more)

### Community 2 - "Presupuestos e Impresion"
Cohesion: 0.05
Nodes (57): Imprimible(), imprimir(), useCambiarEstadoPresupuesto(), useCreatePresupuesto(), useDeletePresupuesto(), usePresupuestos(), useUpdatePresupuesto(), cantidadItem() (+49 more)

### Community 3 - "Compras a Proveedores"
Cohesion: 0.05
Nodes (49): StatCard(), StatCardProps, StatRow(), StatVariant, VARIANTS, CLAVES_AFECTADAS, useCompras(), useCreateCompra() (+41 more)

### Community 4 - "Usuarios Roles y Permisos"
Cohesion: 0.07
Nodes (44): EmpleadoTurno, Perfil, 1:1 con el usuario de Django (settings.AUTH_USER_MODEL)., IsDueño, Gestión de sucursales, usuarios y error logs: solo el rol Dueño., CambiarPasswordSerializer, CambiarUsuarioSerializer, ComercioSerializer (+36 more)

### Community 5 - "Caja y Arqueo"
Cohesion: 0.09
Nodes (31): CajaConteo, CajaMovimiento, CuentaPago, Meta, Lo que se contó en un contenedor al cerrar el turno. El arqueo se hace…, CajaAperturaSerializer, CajaCierreSerializer, CajaContenedorSerializer (+23 more)

### Community 6 - "Inventario y Stock UI"
Cohesion: 0.08
Nodes (39): Paginacion(), useInventarioResumen(), EstadoInventario(), Filtro, TABS, buscarProductoUniversal(), PRODUCTOS_POR_PAGINA, ProductosQuery (+31 more)

### Community 7 - "Componentes UI Base"
Cohesion: 0.17
Nodes (23): Button(), ButtonProps, Variant, VARIANTS, Input(), InputProps, Modal(), ModalProps (+15 more)

### Community 8 - "Pedidos a Proveedores UI"
Cohesion: 0.08
Nodes (38): PedidosProveedorTab(), SubtabKey, SUBTABS, useActualizarEstadoPedido(), useCrearMovimientoProveedor(), useCrearPedidoManual(), useCreateProveedor(), useMovimientosProveedor() (+30 more)

### Community 9 - "Depositos y Stock Backend"
Cohesion: 0.07
Nodes (24): Deposito, Meta, StockDeposito, DepositoSerializer, InventarioResumenSerializer, Meta, RankingRentabilidadItemSerializer, StockDepositoSerializer (+16 more)

### Community 10 - "Proveedores Backend"
Cohesion: 0.09
Nodes (30): FacturaProveedor, PedidoCatalogo, PedidoManual, Proveedor, ProveedorMovimiento, FacturaProveedorSerializer, Meta, PedidoCatalogoSerializer (+22 more)

### Community 11 - "Precios y Repartos"
Cohesion: 0.07
Nodes (21): Cómo se cotiza un ítem: suelto o en presentación cerrada. "Suelto" es por…, Devuelve (precio_unitario, costo_unitario, kg_reales) para un ítem. `cantidad`…, resolver_precio_item(), Meta, Pedido a domicilio: qué se manda, a dónde y cuánto se cobra por llevarlo. NO…, Reparto, RepartoItem, Meta (+13 more)

### Community 12 - "Formato y Export CSV"
Cohesion: 0.11
Nodes (36): descargarCSV(), ARS, formatFechaSola(), formatMoney(), formatPct(), FilaResultado(), Compras(), useMensual() (+28 more)

### Community 13 - "Catalogo de Productos"
Cohesion: 0.11
Nodes (32): Filtra TODO queryset por el comercio del usuario autenticado y lo setea al…, TenantViewSet, AjustePrecio, CategoriaProducto, Combo, ComboItem, DescuentoCantidad, ListaPrecio (+24 more)

### Community 14 - "Seed y Tests de Modelos"
Cohesion: 0.14
Nodes (19): Tests del asistente. No llaman a la API de Claude: lo que importa acá es que…, CajaSesion, Flujos críticos de caja (Fase 3): apertura/cierre, arqueo con diferencias, y…, Registrar una compra tiene que sumar stock y actualizar el saldo del proveedor…, Seed de datos FICTICIOS para desarrollo (Fase 0). Crea: 1 comercio demo…, BaseModel, Comercio, ComercioDispositivo (+11 more)

### Community 15 - "Tests de Contabilidad"
Cohesion: 0.08
Nodes (10): ContabilidadTests, EstadisticasTests, InicioTests, APITestCase, Dashboard de Inicio. Lo que se testea acá es lo que no es obvio: el día local…, A las 02:00 UTC todavía son las 23:00 de AYER en Buenos Aires (UTC-3). Si…, Lo contable: que Resultado y Flujo de caja den distinto cuando tienen que dar…, El punto de toda la sección: comprar mercadería no te hace perder plata, te… (+2 more)

### Community 16 - "API Clientes Frontend"
Cohesion: 0.10
Nodes (36): CLIENTES_POR_PAGINA, ClientesQuery, useAsignacionesCliente(), useAsignarVendedor(), useClientes(), useCrearMovimientoCliente(), useCreateCliente(), useDesactivarAsignacion() (+28 more)

### Community 17 - "Asistente IA Modelos"
Cohesion: 0.09
Nodes (26): AccionPendiente, Meta, Algo que el asistente propuso y todavía no se ejecutó. El modelo nunca escribe…, AccionPendienteSerializer, ConfirmarSerializer, ConsultaSerializer, CuentaSerializer, Meta (+18 more)

### Community 18 - "Formularios y Toasts"
Cohesion: 0.07
Nodes (36): useToast(), extraerMensajeError(), useActualizarSucursal(), useCrearSucursal(), SucursalFormModal(), handleSubmit(), useCuentaAsistente(), useGuardarCuentaAsistente() (+28 more)

### Community 19 - "Tests Multi-Tenant Productos"
Cohesion: 0.06
Nodes (12): AislamientoMultiTenantTests, AjustePrecioMasivoTests, AltaProductoAutocompletadoTests, ComboTests, CostoPorEnvaseCerradoTests, EliminarProductoTests, APITestCase, Aumento masivo de precios + historial (Fase 1, criterio de aceptación). (+4 more)

### Community 20 - "Compras Backend"
Cohesion: 0.11
Nodes (20): Compra, CompraItem, CompraPago, Meta, Compra a proveedor. La mercadería entra (suma stock) el día `fecha`, pero la…, Un pago (total o parcial) de una compra a proveedor. `fecha` es la fecha real…, CompraCreateSerializer, CompraItemInputSerializer (+12 more)

### Community 21 - "Control de Caja UI"
Cohesion: 0.11
Nodes (29): ACCENT_ICON_BG, KpiCard(), KpiCardProps, CuentaPagoInput, useCajaActual(), useCrearMovimiento(), useCuentasPago(), useMovimientos() (+21 more)

### Community 22 - "Tests de Arqueo"
Cohesion: 0.09
Nodes (7): ArqueoPorContenedorTests, CajaAperturaCierreTests, ContenedoresYTransferenciasTests, APITestCase, El arqueo se hace contenedor por contenedor. Con un único total, la plata…, El caso que rompía todos los días: $10.000 en efectivo y $50.000 por…, Su plata existe igual: si se cayera del arqueo, el turno cerraría con un…

### Community 23 - "Cliente Claude API"
Cohesion: 0.10
Nodes (24): AsistenteNoConfigurado, _cliente(), conversar(), credenciales(), _ejecutar(), Exception, Conversación con Claude: arma el prompt, corre el bucle de herramientas. Se usa…, Corre la conversación hasta que el modelo termina de responder. `mensajes` es… (+16 more)

### Community 24 - "Tests Core y Sucursales"
Cohesion: 0.09
Nodes (13): ComercioActivoTests, EmpleadoTurnoTests, MiCuentaTests, MultiSucursalMixin, APITestCase, patch, Config: "Mi cuenta" — el usuario ve y cambia su propio usuario/contraseña., Un usuario Dueño que opera dos sucursales (Comercio), como el caso real de un… (+5 more)

### Community 25 - "API Ventas y Periodos"
Cohesion: 0.11
Nodes (21): Periodo, PERIODOS, useAnularVenta(), useVendedores(), useVentas(), VENTAS_POR_PAGINA, FiltrosBar(), Props (+13 more)

### Community 26 - "Estadisticas y Rankings"
Cohesion: 0.11
Nodes (25): useRankings(), useRentabilidad(), useResumen(), useVerdadDelNegocio(), Rankings(), Rentabilidad(), Comparativa, MetodoPago (+17 more)

### Community 27 - "Configuracion y WhatsApp"
Cohesion: 0.11
Nodes (28): EstadoWhatsApp, useActualizarRolUsuario(), useCambiarPassword(), useCambiarUsuario(), useDescargarRespaldo(), useDesconectarWhatsApp(), useEstadoWhatsApp(), useQuitarUsuario() (+20 more)

### Community 28 - "Admin SaaS Multi-Sucursal"
Cohesion: 0.13
Nodes (20): ComercioAdminSerializer, ErrorLogSerializer, Meta, Sucursal (Comercio) con KPIs del día, calculados y adjuntados a la instancia…, ComercioAdminViewSet, ErrorLogViewSet, Sucursales (Comercio) que opera el usuario autenticado, con KPIs comparativos…, Alta de una nueva sucursal: el usuario que la crea queda como Dueño. (+12 more)

### Community 29 - "Tests Acciones Asistente"
Cohesion: 0.10
Nodes (8): AccionesPendientesTests, CuotaTests, Mejor avisar antes de que la persona confirme algo que va a fallar., El límite diario es lo que hace que el costo sea acotable por sucursal., Lo importante del límite: una consulta bloqueada no se paga., Lo leído de caché sale ~10x más barato: si no se separa, el costo estimado…, El asistente propone; ejecuta una persona., Corre /consultar/ con el bucle de Claude mockeado.

### Community 30 - "Tabla y Admin UI"
Cohesion: 0.16
Nodes (20): Column, Table(), TableProps, useErrorLogs(), useSucursales(), ErrorLogsPanel(), Sucursales(), ErrorLogEntry (+12 more)

### Community 31 - "Deploy y Dependencias"
Cohesion: 0.11
Nodes (28): ComercioFiscalConfig.cert_ref (Referencia del certificado), Certificados ARCA/AFIP, Facturación electrónica WSAA / WSFEv1, Asistente con IA (anthropic) opcional, Stack Django 6.1 + DRF + SimpleJWT, Dependencias de producción (gunicorn + psycopg), pyafipws instalado desde GitHub (pin de commit), setuptools como shim de distutils (+20 more)

### Community 32 - "Shell Rutas y Layout"
Cohesion: 0.15
Nodes (17): RUTAS_DE_SECCION, Brand(), SeccionTabs(), useAuth(), ToastProvider(), Config(), ModulePlaceholder(), MODULOS_IMPLEMENTADOS (+9 more)

### Community 33 - "Tests Bucle Conversacion"
Cohesion: 0.16
Nodes (10): _Bloque, BucleDeConversacionTests, ConteoDeTokensTests, APITestCase, Imita un content block de la respuesta de la API., Prueba el bucle de herramientas sin llamar a la API de Claude., Un modelo en loop no puede llamar herramientas para siempre., Los tokens se acumulan en TODAS las vueltas del bucle. Con respuestas falsas… (+2 more)

### Community 34 - "Etiquetas y Combos"
Cohesion: 0.12
Nodes (16): Row, BarcodeLabel(), Seleccion, Row, useCreateCombo(), useProductoSearch(), ComboFormModal(), handleSubmit() (+8 more)

### Community 35 - "Tests Compra Fiada"
Cohesion: 0.13
Nodes (5): CompraFiadaTests, CompraTests, APITestCase, Compra a proveedor "fiada": la mercadería llega el 23/08 pero se paga el 15/09.…, Compra de $600 entregada el 23/08, a pagar el 15/09.

### Community 36 - "Venta Fraccionada Rationale"
Cohesion: 0.13
Nodes (5): La venta fraccionada no es sólo para peso: la soga se corta por metro y los…, Lo importante del mecanismo: cortar 5 m y vender un rollo entero descuentan del…, El margen del rollo tiene que compararse contra lo que costaron sus 15 m, no…, VentaAnulacionYFiltrosTests, VentaFraccionadaMetroYUnidadTests

### Community 37 - "TS Config App"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 38 - "Asistente UI"
Cohesion: 0.15
Nodes (18): useConfirmarAccion(), useConsultarAsistente(), useCuotaAsistente(), Asistente(), handleSubmit(), preguntar(), SUGERENCIAS, TarjetaAccion() (+10 more)

### Community 39 - "Carrito POS"
Cohesion: 0.20
Nodes (15): CantidadPorPeso(), Cart(), Props, superaStock(), cantidadInputId(), kgEquivalente(), precioProducto(), precioUnitario() (+7 more)

### Community 40 - "Cobro y Cliente POS"
Cohesion: 0.19
Nodes (16): useDebounce(), ResultadoVenta, useClientesBrowse(), useClientesSearch(), useCuentasPago(), ClienteSelectorModal(), aCentavos(), DatosCobro (+8 more)

### Community 41 - "API Inventario Frontend"
Cohesion: 0.18
Nodes (16): Deposito, DepositoInput, InventarioResumen, Paginated, RankingItem, StockDeposito, TransferenciaStockInput, useCreateDeposito() (+8 more)

### Community 42 - "TS Config Node"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 43 - "Serializers Estadisticas"
Cohesion: 0.11
Nodes (18): ActividadSerializer, ComparativaSerializer, DeudorSerializer, InicioComparacionSerializer, InicioDeudasSerializer, InicioDiaSerializer, InicioDiaSerieSerializer, InicioPendientesSerializer (+10 more)

### Community 44 - "Bot de WhatsApp"
Cohesion: 0.11
Nodes (18): dotenv, express, qrcode-terminal, dependencies, dotenv, express, qrcode, qrcode-terminal (+10 more)

### Community 45 - "Pantalla de Inicio"
Cohesion: 0.16
Nodes (13): useInicio(), ACCESOS, diaCorto(), Inicio(), saludo(), Deudor, Inicio, InicioComparacion (+5 more)

### Community 46 - "Cola Offline POS"
Cohesion: 0.16
Nodes (13): contarPendientes(), dbPromise, listarPendientes(), PosDB, quitarPendiente(), VentaPendiente, CuentaPago, VentaInput (+5 more)

### Community 48 - "Tests Descuento por Item"
Cohesion: 0.19
Nodes (4): Sin tope, un 200% dejaría el precio negativo y la venta pagaría al cliente. El…, Comercio.permitir_venta_sin_stock nace en True: un stock mal cargado (todo en 0…, Te hago 10% en la gaseosa": rebaja esa línea y ninguna otra. `precio_unitario`…, VentaCompletaTests

### Community 49 - "Deudas por Antiguedad"
Cohesion: 0.16
Nodes (15): useDeudas(), Antiguedad(), BarraTramos(), colorDias(), TRAMOS, CategoriaRentabilidad, Conciliacion, Deudas (+7 more)

### Community 50 - "Community 50"
Cohesion: 0.19
Nodes (15): useCreateTurno(), useDeleteTurno(), useTurnos(), useUpdateTurno(), TurnoFormModal(), handleDelete(), handleSubmit(), TurnoFormModalProps (+7 more)

### Community 51 - "Community 51"
Cohesion: 0.19
Nodes (16): costo_usd(), CuotaAgotada, _hoy(), Exception, Límite diario de consultas y registro de consumo real del asistente. El límite…, Se acabaron las consultas del día para esta sucursal., Chequea el cupo antes de gastar. Devuelve cuántas quedan., Suma una consulta y sus tokens. `uso_api` viene de la respuesta de la API. Se… (+8 more)

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (17): @fontsource/inter, @fontsource/jetbrains-mono, @fontsource/space-grotesk, dependencies, @fontsource/inter, @fontsource/jetbrains-mono, @fontsource/space-grotesk, idb (+9 more)

### Community 53 - "Community 53"
Cohesion: 0.12
Nodes (17): devDependencies, oxlint, @types/node, @types/qrcode, @types/react, @types/react-dom, typescript, vite (+9 more)

### Community 54 - "Community 54"
Cohesion: 0.21
Nodes (14): useCreateLead(), useLeads(), useUpdateLead(), LeadFormModal(), handleSubmit(), COLOR_ESTADO, ESTADOS, formatFecha() (+6 more)

### Community 55 - "Community 55"
Cohesion: 0.21
Nodes (13): buscarProductoPorCodigo(), useBuscarProductosPos(), tieneBolsa(), ProductSearch(), agregar(), handleKeyDown(), Props, Props (+5 more)

### Community 56 - "Community 56"
Cohesion: 0.12
Nodes (4): CuentaEndpointTests, HerramientasTests, Las consultas nunca pueden cruzar de sucursal., La API key del cliente entra, pero no sale.

### Community 57 - "Community 57"
Cohesion: 0.21
Nodes (15): Display-P3 Color With sRGB Fallback, Favicon Lightning Bolt Mark, Masked Blurred-Ellipse Gradient Layer, Violet Brand Palette (#863bff / #7e14ff / #ede6ff / #47bfff), bluesky-clip clipPath Definition, bluesky-icon Symbol, discord-icon Symbol, documentation-icon Symbol (+7 more)

### Community 58 - "Community 58"
Cohesion: 0.25
Nodes (12): useColaFiscal(), useFacturarVenta(), useProcesarPendientes(), ColaFiscal(), procesarTodas(), reintentar(), ESTADO_ESTILO, ESTADO_LABEL (+4 more)

### Community 59 - "Community 59"
Cohesion: 0.14
Nodes (4): Cobrar una venta con varios medios a la vez. Caso de referencia: $48.000 =…, Lo fiado no es plata que entró: los pagos cubren sólo el resto., La cola offline puede tener ventas guardadas con el formato viejo., VentaPagoMixtoTests

### Community 60 - "Community 60"
Cohesion: 0.20
Nodes (9): App(), AuthContext, AuthContextValue, Comercio, Perfil, api, comercioStorage, tokenStorage (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.21
Nodes (8): comparar_con_periodo_anterior(), productos_mas_vendidos(), _rango(), Herramientas que el asistente puede usar para responder sobre el negocio. Dos…, Cuánto se vendió en los últimos N días contra los N anteriores., Interpreta el rango pedido. Por defecto, hoy — en hora local del comercio, no…, resumen_ventas(), _ventas()

### Community 62 - "Community 62"
Cohesion: 0.23
Nodes (8): ClienteMovimientoCreateSerializer, ClienteMovimientoSerializer, Pago o ajuste manual a la cuenta corriente (las ventas fiadas generan su propio…, ClienteViewSet, action, Filtro por deuda del lado del servidor. Antes se hacía en el navegador sobre la…, Corrige o borra un pago/ajuste ya cargado. Los cargos de ventas no se tocan…, Clientes con cuenta corriente, límite de crédito y asignación a vendedor (Fase…

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (7): ConsumoInterno, ConsumoInternoItem, Gasto, GastoSerializer, Meta, GastoViewSet, Gastos y pagos a proveedor. Si hay una caja abierta al momento de registrarlo,…

### Community 65 - "Community 65"
Cohesion: 0.20
Nodes (8): crearVenta(), encolarVenta(), PosPage(), agregarProducto(), handleCobrar(), guardarCache(), leerCache(), useCatalogoPOS()

### Community 66 - "Community 66"
Cohesion: 0.45
Nodes (8): ClienteAsignacion, CrmLead, ClienteAsignacionSerializer, ClienteSerializer, CrmLeadSerializer, Meta, ClienteAsignacionViewSet, CrmLeadViewSet

### Community 68 - "Community 68"
Cohesion: 0.20
Nodes (3): ClienteAsignacionTests, CrmLeadTests, APITestCase

### Community 69 - "Community 69"
Cohesion: 0.24
Nodes (9): _cmv(), _flujo(), Costo de la mercadería vendida: lo que costó comprar lo que se vendió. Sale de…, Estado de resultados del período., Movimiento real de plata del período., _resultado(), items_con_costo(), _margen_pct() (+1 more)

### Community 70 - "Community 70"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 71 - "Community 71"
Cohesion: 0.20
Nodes (7): app, {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
}, estado, express, fs, qrcode, qrcodeTerminal

### Community 72 - "Community 72"
Cohesion: 0.22
Nodes (3): ComercioAdminTests, ErrorLogTests, APITestCase

### Community 73 - "Community 73"
Cohesion: 0.22
Nodes (6): desconectar_whatsapp(), enviar_whatsapp(), estado_whatsapp(), Envía un WhatsApp vía el bot QR (whatsapp-bot/). No relanza errores: un bot…, Estado de vinculación del bot (para el QR en Config). La clave del bot nunca…, Cierra la sesión vinculada (para cambiar de celular): el bot borra las…

### Community 74 - "Community 74"
Cohesion: 0.28
Nodes (7): DeudasView, MensualView, APIView, Últimos N meses cerrados + el actual: ventas, CMV, gastos y resultado., Antigüedad de lo que te deben y de lo que debés. En clientes la antigüedad se…, Resultado + flujo de caja + puente entre ambos, del período filtrado., ResultadoView

### Community 75 - "Community 75"
Cohesion: 0.22
Nodes (3): Vuelto dado por un medio distinto al que cobró (ej: cobra en efectivo, no hay…, Default: se asume que el vuelto sale de la misma cuenta que cobró (efectivo) —…, VueltoPorOtraCuentaTests

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 77 - "Community 77"
Cohesion: 0.31
Nodes (7): Membrete(), useComercioConfig(), useUpdateComercioConfig(), PermitirVentaSinStock(), Stock(), TABS, Vista

### Community 78 - "Community 78"
Cohesion: 0.29
Nodes (8): _ajustar_saldo(), aplicar_movimiento_cliente(), Arma el recibo que recibe el cliente por WhatsApp: mismo formato para fiado y…, Actualiza el saldo de cuenta corriente del cliente (lo que le debe al…, _recibo_whatsapp(), _signo(), formatear_monto_ar(), $143.359,08 en vez de $143359.08 — separador de miles con punto, coma decimal…

### Community 79 - "Community 79"
Cohesion: 0.32
Nodes (6): PanelSerializer, egresos_por_dia(), PanelView, Dashboard de Estadísticas: los KPIs del período con su variación contra el…, Últimos movimientos de plata, mezclando ventas, gastos y pagos a proveedor en…, Ídem egresos_en_rango pero desglosado por día. Devuelve todos los días del…

### Community 81 - "Community 81"
Cohesion: 0.25
Nodes (3): APITestCase, Un mismo producto por peso se puede vender suelto (por kg) o en bolsa cerrada,…, VentaPorBolsaTests

### Community 82 - "Community 82"
Cohesion: 0.33
Nodes (6): InicioSerializer, _dia(), InicioView, APIView, Arma el resumen de un día a partir de su fila de la serie semanal. `egresos` en…, Dashboard de Inicio: todo el día a día en una sola llamada — hoy contra ayer,…

### Community 83 - "Community 83"
Cohesion: 0.33
Nodes (6): VerdadDelNegocioSerializer, _rango_por_defecto(), Rentabilidad real por categoría/proveedor/hora + comparativa contra el período…, Variación porcentual contra un período previo. None cuando el anterior es cero:…, _variacion_pct(), VerdadDelNegocioView

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (6): AuthProvider(), fetchMe(), login(), setComercioActivo(), handleSubmit(), elegir()

### Community 85 - "Community 85"
Cohesion: 0.33
Nodes (6): DatosFiscales(), handleSubmit(), FacturacionAutomatica(), handleSubmit(), useFiscalConfig(), useGuardarFiscalConfig()

### Community 86 - "Community 86"
Cohesion: 0.53
Nodes (5): RankingsSerializer, TopProductoSerializer, TopVendedorSerializer, RankingsView, Top productos y top vendedores del período filtrado, por ventas reales.

### Community 87 - "Community 87"
Cohesion: 0.40
Nodes (5): RentabilidadProductoSerializer, Ventas no anuladas del comercio, según los filtros del panel de Estadísticas:…, Margen real (precio vs costo de venta) por producto, a partir de ventas…, RentabilidadView, ventas_filtradas()

### Community 88 - "Community 88"
Cohesion: 0.40
Nodes (5): ResumenSerializer, egresos_en_rango(), KPIs del panel de Estadísticas (Fase 4): ingresos, egresos, balance, margen,…, Plata que salió del negocio: gastos + pagos a proveedor. Los pagos a proveedor…, ResumenView

### Community 91 - "Community 91"
Cohesion: 0.40
Nodes (3): action, Rango de fechas por query param, igual que Ventas y Compras: con cientos de…, Totales por categoría de TODOS los gastos que matchean el filtro. Va aparte del…

### Community 92 - "Community 92"
Cohesion: 0.50
Nodes (3): atomic, Command, BaseCommand

### Community 93 - "Community 93"
Cohesion: 0.50
Nodes (3): PaginacionEstandar, Paginación que respeta `?page_size=`. Sin `page_size_query_param`, DRF ignora…, PageNumberPagination

## Ambiguous Edges - Review These
- `Asistente con IA (anthropic) opcional` → `Título de la app: TIENDA-IA`  [AMBIGUOUS]
  frontend/index.html · relation: conceptually_related_to
- `Favicon Lightning Bolt Mark` → `Vendor Starter-Template Branding Assets`  [AMBIGUOUS]
  frontend/public/favicon.svg · relation: rationale_for
- `SVG Symbol Sprite Sheet` → `Vendor Starter-Template Branding Assets`  [AMBIGUOUS]
  frontend/public/icons.svg · relation: rationale_for

## Knowledge Gaps
- **277 isolated node(s):** `Migration`, `Migration`, `Meta`, `Migration`, `Migration` (+272 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Asistente con IA (anthropic) opcional` and `Título de la app: TIENDA-IA`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Favicon Lightning Bolt Mark` and `Vendor Starter-Template Branding Assets`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **What is the exact relationship between `SVG Symbol Sprite Sheet` and `Vendor Starter-Template Branding Assets`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `Producto` connect `Seed y Tests de Modelos` to `Facturacion Fiscal ARCA`, `Cuenta Corriente Clientes`, `Usuarios Roles y Permisos`, `Depositos y Stock Backend`, `Proveedores Backend`, `Precios y Repartos`, `Catalogo de Productos`, `Asistente IA Modelos`, `Tests Multi-Tenant Productos`, `Compras Backend`, `Admin SaaS Multi-Sucursal`, `Community 61`, `Community 63`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `resolver_comercio_activo()` connect `Caja y Arqueo` to `Facturacion Fiscal ARCA`, `Cuenta Corriente Clientes`, `Usuarios Roles y Permisos`, `Depositos y Stock Backend`, `Proveedores Backend`, `Precios y Repartos`, `Catalogo de Productos`, `Seed y Tests de Modelos`, `Asistente IA Modelos`, `Compras Backend`, `Cliente Claude API`, `Community 63`, `Community 69`, `Community 74`, `Community 79`, `Community 82`, `Community 83`, `Community 86`, `Community 87`, `Community 88`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `TenantModel` connect `Admin SaaS Multi-Sucursal` to `Facturacion Fiscal ARCA`, `Cuenta Corriente Clientes`, `Community 66`, `Usuarios Roles y Permisos`, `Caja y Arqueo`, `Depositos y Stock Backend`, `Proveedores Backend`, `Precios y Repartos`, `Catalogo de Productos`, `Seed y Tests de Modelos`, `Asistente IA Modelos`, `Community 51`, `Compras Backend`, `Community 63`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `Migration`, `Migration`, `Meta` to the rest of the system?**
  _277 weakly-connected nodes found - possible documentation gaps or missing edges._