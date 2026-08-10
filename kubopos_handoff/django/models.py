"""
Kubo Gestión v2.0 — models.py (Django)
Reconstrucción del esquema (inferido del sistema original en Supabase) para Django + DRF.

Convenciones:
- Multi-tenant: casi todo cuelga de `Comercio`. Usá TenantModel como base.
- UUID como PK (compatible con el esquema original y evita enumeración de IDs).
- Nombres de campos en español, iguales a la especificación, para no perder trazabilidad.
- Los datos transaccionales (ventas, caja, fiscal) NO se borran: se anulan.
- Aislamiento por comercio: hacelo en el queryset/permiso de DRF, no solo en el front.

Este archivo se puede partir por app (productos/models.py, ventas/models.py, etc.).
Ajustá max_length, null/blank e índices según tus necesidades reales.
"""
import uuid
from django.db import models
from django.conf import settings


# ---------------------------------------------------------------------------
# Bases
# ---------------------------------------------------------------------------
class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantModel(BaseModel):
    """Todo lo que pertenece a un comercio. Filtrar SIEMPRE por comercio en las vistas."""
    comercio = models.ForeignKey("Comercio", on_delete=models.CASCADE)

    class Meta:
        abstract = True


# ---------------------------------------------------------------------------
# 1. Plataforma / tenant / usuarios
# ---------------------------------------------------------------------------
class Comercio(BaseModel):
    nombre = models.CharField(max_length=200)
    cuit = models.CharField(max_length=20, blank=True)
    direccion = models.CharField(max_length=300, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    logo_url = models.URLField(blank=True)
    rubro = models.CharField(max_length=50, blank=True)  # kiosco, heladeria, indumentaria...
    activo = models.BooleanField(default=True)
    bloqueado = models.BooleanField(default=False)
    bloqueado_motivo = models.CharField(max_length=300, blank=True)
    kubobots_empleados_enabled = models.BooleanField(default=False)
    kubobots_clientes_enabled = models.BooleanField(default=False)
    kubobots_fid_tasa = models.DecimalField(max_digits=10, decimal_places=4, default=0)

    def __str__(self):
        return self.nombre


class Perfil(BaseModel):
    """1:1 con el usuario de Django (settings.AUTH_USER_MODEL)."""
    ROLES = [("Dueño", "Dueño"), ("Administrador", "Administrador"),
             ("Cajero", "Cajero"), ("Repositor", "Repositor")]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="perfil")
    comercio = models.ForeignKey(Comercio, on_delete=models.SET_NULL, null=True, blank=True)
    nombre_completo = models.CharField(max_length=200, blank=True)
    rol = models.CharField(max_length=30, choices=ROLES, default="Cajero")
    activo = models.BooleanField(default=True)


class UsuarioComercio(BaseModel):
    """N:M usuario<->comercio con rol (un usuario puede operar varios comercios)."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comercio = models.ForeignKey(Comercio, on_delete=models.CASCADE)
    rol = models.CharField(max_length=30, default="Cajero")

    class Meta:
        unique_together = ("user", "comercio")


class ComercioDispositivo(TenantModel):
    device_id = models.CharField(max_length=100)
    nombre = models.CharField(max_length=100, blank=True)
    ultima_vez = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("comercio", "device_id")


class EmpleadoTurno(TenantModel):
    empleado = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    fecha = models.DateField()
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    notas = models.TextField(blank=True)


# ---------------------------------------------------------------------------
# 2. Catálogo / productos
# ---------------------------------------------------------------------------
class CategoriaProducto(TenantModel):
    nombre = models.CharField(max_length=120)
    orden = models.IntegerField(default=0)
    activa = models.BooleanField(default=True)


class SubcategoriaProducto(TenantModel):
    categoria = models.ForeignKey(CategoriaProducto, on_delete=models.SET_NULL, null=True, blank=True)
    nombre = models.CharField(max_length=120)
    orden = models.IntegerField(default=0)
    activa = models.BooleanField(default=True)


class ProductoUniversal(BaseModel):
    """Catálogo maestro GLOBAL (no por comercio): autocompletar por código de barras."""
    codigo_barras = models.CharField(max_length=64, unique=True, null=True, blank=True)
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    categoria = models.CharField(max_length=120, blank=True)
    marca = models.CharField(max_length=120, blank=True)
    verificado = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)


class Proveedor(TenantModel):
    nombre = models.CharField(max_length=200)
    cuit = models.CharField(max_length=20, blank=True)
    contacto = models.CharField(max_length=200, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.CharField(max_length=300, blank=True)
    categoria = models.CharField(max_length=120, blank=True)
    condicion_pago = models.CharField(max_length=100, blank=True)
    notas = models.TextField(blank=True)
    saldo_actual = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    instrucciones_parseo = models.TextField(blank=True)  # parseo automático de facturas
    activo = models.BooleanField(default=True)


class Producto(TenantModel):
    UNIDADES = [("unidad", "unidad"), ("kg", "kg"), ("g", "g"), ("lt", "lt")]
    codigo_barras = models.CharField(max_length=64, blank=True, db_index=True)
    nombre = models.CharField(max_length=200, db_index=True)
    descripcion = models.TextField(blank=True)
    categoria = models.CharField(max_length=120, blank=True)
    subcategoria = models.CharField(max_length=120, blank=True)
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    precio_costo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    alicuota_iva = models.DecimalField(max_digits=5, decimal_places=2, default=21)  # 21 / 10.5 / 0
    # stock
    stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    stock_reservado = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    stock_deposito = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    # venta por peso / balanza
    venta_por_peso = models.BooleanField(default=False)
    unidad_medida = models.CharField(max_length=20, choices=UNIDADES, default="unidad")
    plu_balanza = models.CharField(max_length=20, blank=True)
    # ofertas con vigencia
    precio_oferta = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    oferta_activa = models.BooleanField(default=False)
    fecha_inicio_oferta = models.DateTimeField(null=True, blank=True)
    fecha_fin_oferta = models.DateTimeField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    # ubicación física
    pasillo = models.CharField(max_length=50, blank=True)
    estante = models.CharField(max_length=50, blank=True)
    # indumentaria (variantes)
    modelo_id = models.UUIDField(null=True, blank=True)
    modelo_nombre = models.CharField(max_length=200, blank=True)
    talle = models.CharField(max_length=20, blank=True)
    talle_orden = models.IntegerField(null=True, blank=True)
    color = models.CharField(max_length=40, blank=True)
    # media / flags
    imagen_url = models.URLField(blank=True)
    destacado = models.BooleanField(default=False)
    novedad = models.BooleanField(default=False)
    sync_source = models.ForeignKey(ProductoUniversal, on_delete=models.SET_NULL, null=True, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["comercio", "codigo_barras"]),
            models.Index(fields=["comercio", "activo"]),
        ]

    @property
    def stock_bajo(self):
        return self.stock <= self.stock_minimo


class ProductGroup(TenantModel):
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True)


class ListaPrecio(TenantModel):
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True)
    ajuste_pct = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)


class DescuentoCantidad(TenantModel):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad_min = models.DecimalField(max_digits=14, decimal_places=3)
    descuento_pct = models.DecimalField(max_digits=6, decimal_places=2)
    activo = models.BooleanField(default=True)


class AjustePrecio(TenantModel):
    """Historial de aumentos masivos de precios."""
    descripcion = models.CharField(max_length=200, blank=True)
    tipo = models.CharField(max_length=20, blank=True)  # porcentaje | monto
    valor = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    filtro = models.JSONField(null=True, blank=True)
    aplicado_por = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    cant_productos = models.IntegerField(default=0)


class Combo(TenantModel):
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    precio = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)


class ComboItem(BaseModel):
    combo = models.ForeignKey(Combo, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)


# ---------------------------------------------------------------------------
# 3. Depósitos / stock
# ---------------------------------------------------------------------------
class Deposito(TenantModel):
    nombre = models.CharField(max_length=120)
    direccion = models.CharField(max_length=300, blank=True)
    activo = models.BooleanField(default=True)


class StockDeposito(TenantModel):
    deposito = models.ForeignKey(Deposito, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        unique_together = ("deposito", "producto")


class BaldeHeladeria(TenantModel):
    sabor = models.CharField(max_length=120, blank=True)
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    peso_inicial = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    peso_actual = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    estado = models.CharField(max_length=30, default="activo")


# ---------------------------------------------------------------------------
# 4. Clientes / CRM / fidelización (Kubobots)
# ---------------------------------------------------------------------------
class Cliente(TenantModel):
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    celular = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    cuit = models.CharField(max_length=20, blank=True)
    direccion = models.CharField(max_length=300, blank=True)
    tipo = models.CharField(max_length=40, default="consumidor_final")
    saldo_actual = models.DecimalField(max_digits=14, decimal_places=2, default=0)  # cta corriente
    limite_credito = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    kubobots_fid_off = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)


class ClienteAsignacion(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE)
    vendedor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    activo = models.BooleanField(default=True)


class CrmLead(TenantModel):
    nombre = models.CharField(max_length=200, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    estado = models.CharField(max_length=40, default="nuevo")
    notas = models.TextField(blank=True)


class KubobotsCliente(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, null=True, blank=True)
    puntos = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    puntos_historicos = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    liga = models.CharField(max_length=40, blank=True)


class KubobotsMision(TenantModel):
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    objetivo = models.JSONField(null=True, blank=True)
    recompensa = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    activa = models.BooleanField(default=True)


class KubobotsRecompensa(TenantModel):
    nombre = models.CharField(max_length=200)
    costo_puntos = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    activa = models.BooleanField(default=True)


class KubobotsCanje(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    recompensa = models.ForeignKey(KubobotsRecompensa, on_delete=models.SET_NULL, null=True, blank=True)
    puntos = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)


# ---------------------------------------------------------------------------
# 5. Caja / medios de pago
# ---------------------------------------------------------------------------
class CuentaPago(TenantModel):
    nombre = models.CharField(max_length=120)  # Efectivo, Tarjeta, MercadoPago, Transferencia
    tipo = models.CharField(max_length=40, blank=True)
    comision_pct = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)


class CajaSesion(TenantModel):
    ESTADOS = [("abierta", "abierta"), ("cerrada", "cerrada")]
    cajero = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADOS, default="abierta")
    monto_apertura = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_cierre = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    monto_esperado = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    diferencia = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)


class CajaMovimiento(TenantModel):
    sesion = models.ForeignKey(CajaSesion, on_delete=models.CASCADE, null=True, blank=True)
    tipo = models.CharField(max_length=20)  # ingreso | egreso
    concepto = models.CharField(max_length=200, blank=True)
    monto = models.DecimalField(max_digits=14, decimal_places=2)


# ---------------------------------------------------------------------------
# 6. Ventas
# ---------------------------------------------------------------------------
class Venta(TenantModel):
    numero_ticket = models.BigIntegerField(null=True, blank=True)
    vendedor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    caja_sesion = models.ForeignKey(CajaSesion, on_delete=models.SET_NULL, null=True, blank=True)
    cuenta_pago = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    recargo_monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    comision_monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    metodo_pago = models.CharField(max_length=40, blank=True)  # efectivo|tarjeta|transferencia|mixto
    monto_efectivo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_tarjeta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_transferencia = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    efectivo_recibido = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    vuelto = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    origen = models.CharField(max_length=40, default="pos")
    # anulación (NUNCA borrar una venta)
    anulada = models.BooleanField(default=False)
    motivo_anulacion = models.CharField(max_length=300, blank=True)
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    # fiscal
    facturado = models.BooleanField(default=False)
    excluir_fiscal = models.BooleanField(default=False)
    cae = models.CharField(max_length=40, blank=True)
    cae_vencimiento = models.DateField(null=True, blank=True)
    tipo_factura = models.CharField(max_length=5, blank=True)  # A | B | C
    numero_factura = models.CharField(max_length=40, blank=True)
    punto_venta_factura = models.CharField(max_length=20, blank=True)
    fecha_facturacion = models.DateTimeField(null=True, blank=True)
    comprador_fiscal = models.CharField(max_length=200, blank=True)
    comprador_datos = models.JSONField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "-created_at"])]


class VentaItem(BaseModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    combo = models.ForeignKey(Combo, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    peso_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    costo_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)


class Presupuesto(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    numero = models.CharField(max_length=40, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    estado = models.CharField(max_length=40, default="pendiente")
    validez = models.DateField(null=True, blank=True)


class PresupuestoItem(BaseModel):
    presupuesto = models.ForeignKey(Presupuesto, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)


# ---------------------------------------------------------------------------
# 7. Compras / proveedores / pedidos
# ---------------------------------------------------------------------------
class Compra(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    numero_factura = models.CharField(max_length=40, blank=True)
    fecha = models.DateField()
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pagado = models.BooleanField(default=False)


class CompraItem(BaseModel):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    costo_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)


class FacturaProveedor(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    numero = models.CharField(max_length=40, blank=True)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha = models.DateField(null=True, blank=True)
    archivo_url = models.URLField(blank=True)
    parseado = models.JSONField(null=True, blank=True)


class ProveedorMovimiento(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=30)  # compra | pago | ajuste
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    referencia = models.CharField(max_length=120, blank=True)


class PedidoCatalogo(TenantModel):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    datos = models.JSONField(null=True, blank=True)
    estado = models.CharField(max_length=40, default="borrador")


class PedidoManual(TenantModel):
    detalle = models.JSONField(null=True, blank=True)
    estado = models.CharField(max_length=40, default="pendiente")


# ---------------------------------------------------------------------------
# 8. Finanzas
# ---------------------------------------------------------------------------
class Gasto(TenantModel):
    categoria = models.CharField(max_length=120, blank=True)
    descripcion = models.CharField(max_length=300, blank=True)
    monto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha = models.DateField()


class ConsumoInterno(TenantModel):
    persona = models.CharField(max_length=200, blank=True)
    persona_ref = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    tipo_precio = models.CharField(max_length=20, default="costo")  # costo | venta
    total_costo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    fecha = models.DateTimeField(auto_now_add=True)


class ConsumoInternoItem(BaseModel):
    consumo = models.ForeignKey(ConsumoInterno, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    nombre_producto = models.CharField(max_length=200, blank=True)
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    peso_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    unidad_medida = models.CharField(max_length=20, blank=True)
    precio_costo = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    precio_venta = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)


# ---------------------------------------------------------------------------
# 9. Fiscal (AFIP/ARCA)
# ---------------------------------------------------------------------------
class ComercioFiscalConfig(TenantModel):
    cuit = models.CharField(max_length=20, blank=True)
    razon_social = models.CharField(max_length=200, blank=True)
    punto_venta = models.CharField(max_length=20, blank=True)
    condicion_iva = models.CharField(max_length=60, blank=True)
    es_principal = models.BooleanField(default=False)
    # OJO: el certificado/clave AFIP NO va en texto plano acá. Guardar en un secret store
    # (variables de entorno, django-environ, o un gestor de secretos) y referenciar acá.
    cert_ref = models.CharField(max_length=200, blank=True)
    activo = models.BooleanField(default=True)


class FiscalBatch(TenantModel):
    status = models.CharField(max_length=30, default="pendiente")
    cantidad = models.IntegerField(default=0)


class FiscalQueue(TenantModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, null=True, blank=True)
    batch = models.ForeignKey(FiscalBatch, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=30, default="pendiente")  # pendiente|procesando|ok|error
    cae = models.CharField(max_length=40, blank=True)
    cae_vencimiento = models.DateField(null=True, blank=True)
    punto_venta = models.CharField(max_length=20, blank=True)
    numero_factura = models.CharField(max_length=40, blank=True)
    tipo_comprobante = models.CharField(max_length=20, blank=True)
    error_msg = models.TextField(blank=True)


# ---------------------------------------------------------------------------
# 10. Auditoría / telemetría / sistema
# ---------------------------------------------------------------------------
class AuditLog(TenantModel):
    user_id = models.UUIDField(null=True, blank=True)
    accion = models.CharField(max_length=60, blank=True)
    entidad = models.CharField(max_length=60, blank=True)
    entidad_id = models.UUIDField(null=True, blank=True)
    datos = models.JSONField(null=True, blank=True)


class ErrorLog(TenantModel):
    user_id = models.UUIDField(null=True, blank=True)
    user_nombre = models.CharField(max_length=200, blank=True)
    tipo = models.CharField(max_length=60, blank=True)
    mensaje = models.TextField(blank=True)
    stack = models.TextField(blank=True)
    url = models.CharField(max_length=500, blank=True)
    linea = models.IntegerField(null=True, blank=True)
    columna = models.IntegerField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    modulo = models.CharField(max_length=60, blank=True)


class AlertaLeida(TenantModel):
    user_id = models.UUIDField(null=True, blank=True)
    alerta_key = models.CharField(max_length=120, blank=True)


class UiEvent(TenantModel):
    modulo = models.CharField(max_length=60, blank=True)
    elemento = models.CharField(max_length=120, blank=True)
    x = models.IntegerField(null=True, blank=True)
    y = models.IntegerField(null=True, blank=True)


class UiHeatmap(TenantModel):
    modulo = models.CharField(max_length=60, blank=True)
    fecha = models.DateField(null=True, blank=True)
    viewport_w = models.IntegerField(null=True, blank=True)
    viewport_h = models.IntegerField(null=True, blank=True)
    grid = models.JSONField(null=True, blank=True)
    sesion_count = models.IntegerField(default=0)
