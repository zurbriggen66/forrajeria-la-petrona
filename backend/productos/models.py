from django.db import models
from core.models import BaseModel, TenantModel
from core.models import Perfil


class CategoriaProducto(TenantModel):
    nombre = models.CharField(max_length=120)
    orden = models.IntegerField(default=0)
    activa = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


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

    def __str__(self):
        return self.nombre


class Producto(TenantModel):
    UNIDADES = [("unidad", "unidad"), ("kg", "kg"), ("g", "g"), ("lt", "lt")]
    codigo_barras = models.CharField(max_length=64, blank=True, db_index=True)
    nombre = models.CharField(max_length=200, db_index=True)
    descripcion = models.TextField(blank=True)
    categoria = models.CharField(max_length=120, blank=True)
    subcategoria = models.CharField(max_length=120, blank=True)
    proveedor = models.ForeignKey("proveedores.Proveedor", on_delete=models.SET_NULL, null=True, blank=True)
    precio_costo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    alicuota_iva = models.DecimalField(max_digits=5, decimal_places=2, default=21)  # 21 / 10.5 / 0
    # stock
    stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    stock_reservado = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    stock_deposito = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    # venta a granel — el mismo producto puede venderse suelto por kg (precio_venta,
    # interpretado "por kg" cuando venta_por_peso=True) y, opcionalmente, también en
    # bolsa cerrada de bolsa_kg kilos a precio_bolsa. El stock siempre se guarda en kg:
    # las dos formas de venta descuentan del mismo pozo (ver ventas/views.py).
    venta_por_peso = models.BooleanField(default=False)
    unidad_medida = models.CharField(max_length=20, choices=UNIDADES, default="unidad")
    precio_bolsa = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    bolsa_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    # Preferencia de visualización/carga: `stock` sigue guardándose en kg
    # siempre (ver comentario arriba); esto sólo cambia en qué unidad lo
    # tipea y lo ve el dueño cuando el producto tiene bolsa cerrada.
    stock_en_bolsas = models.BooleanField(default=False)
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

    def __str__(self):
        return self.nombre

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
