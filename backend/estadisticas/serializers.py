from rest_framework import serializers


class ResumenSerializer(serializers.Serializer):
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    egresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()
    ticket_promedio = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class TopProductoSerializer(serializers.Serializer):
    producto = serializers.UUIDField(allow_null=True)
    nombre = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3)
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)


class TopVendedorSerializer(serializers.Serializer):
    vendedor = serializers.UUIDField(allow_null=True)
    nombre = serializers.CharField()
    cantidad_ventas = serializers.IntegerField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)


class RankingsSerializer(serializers.Serializer):
    top_productos = TopProductoSerializer(many=True)
    top_vendedores = TopVendedorSerializer(many=True)


class RentabilidadProductoSerializer(serializers.Serializer):
    producto = serializers.UUIDField()
    nombre = serializers.CharField()
    categoria = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3)
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    costo = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()


class RentabilidadCategoriaSerializer(serializers.Serializer):
    categoria = serializers.CharField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    costo = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()


class RentabilidadProveedorSerializer(serializers.Serializer):
    proveedor = serializers.UUIDField(allow_null=True)
    nombre = serializers.CharField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    costo = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()


class RentabilidadHoraSerializer(serializers.Serializer):
    hora = serializers.IntegerField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class PeriodoSerializer(serializers.Serializer):
    desde = serializers.DateField()
    hasta = serializers.DateField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class ComparativaSerializer(serializers.Serializer):
    periodo_actual = PeriodoSerializer()
    periodo_anterior = PeriodoSerializer()
    variacion_ingresos_pct = serializers.FloatField(allow_null=True)
    variacion_cantidad_pct = serializers.FloatField(allow_null=True)


class VerdadDelNegocioSerializer(serializers.Serializer):
    por_categoria = RentabilidadCategoriaSerializer(many=True)
    por_proveedor = RentabilidadProveedorSerializer(many=True)
    por_hora = RentabilidadHoraSerializer(many=True)
    comparativa = ComparativaSerializer()


class InicioDiaSerializer(serializers.Serializer):
    """Un día del dashboard. `egresos`/`balance` viajan en null para los roles
    que no ven plata del negocio (ver InicioView)."""

    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()
    ticket_promedio = serializers.DecimalField(max_digits=16, decimal_places=2)
    egresos = serializers.DecimalField(max_digits=16, decimal_places=2, allow_null=True)
    balance = serializers.DecimalField(max_digits=16, decimal_places=2, allow_null=True)


class InicioComparacionSerializer(serializers.Serializer):
    # null cuando ayer no tuvo ventas: no existe "X% más que cero".
    variacion_ingresos_pct = serializers.FloatField(allow_null=True)
    variacion_cantidad_pct = serializers.FloatField(allow_null=True)
    promedio_diario_7d = serializers.DecimalField(max_digits=16, decimal_places=2)


class InicioDiaSerieSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class InicioPendientesSerializer(serializers.Serializer):
    repartos_hoy = serializers.IntegerField()
    repartos_pendientes = serializers.IntegerField()
    presupuestos_pendientes = serializers.IntegerField()
    stock_bajo = serializers.IntegerField()
    sin_stock = serializers.IntegerField()
    pedidos_sugeridos = serializers.IntegerField()
    facturas_por_pagar = serializers.IntegerField()
    facturas_vencidas = serializers.IntegerField()


class DeudorSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    nombre = serializers.CharField()
    saldo_actual = serializers.DecimalField(max_digits=14, decimal_places=2)


class InicioDeudasSerializer(serializers.Serializer):
    total_por_cobrar = serializers.DecimalField(max_digits=16, decimal_places=2)
    top_deudores = DeudorSerializer(many=True)
    total_por_pagar = serializers.DecimalField(max_digits=16, decimal_places=2)


class InicioSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    hoy = InicioDiaSerializer()
    ayer = InicioDiaSerializer()
    comparacion = InicioComparacionSerializer()
    serie_7dias = InicioDiaSerieSerializer(many=True)
    pendientes = InicioPendientesSerializer()
    # null para roles sin acceso a la plata del negocio (Cajero / Repositor).
    deudas = InicioDeudasSerializer(allow_null=True)
    top_productos_hoy = TopProductoSerializer(many=True)


class PanelPeriodoSerializer(serializers.Serializer):
    desde = serializers.DateField()
    hasta = serializers.DateField()


class PanelKpisSerializer(serializers.Serializer):
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    egresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    balance = serializers.DecimalField(max_digits=16, decimal_places=2)
    margen_pct = serializers.FloatField()
    ticket_promedio = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()
    capital_inmovilizado = serializers.DecimalField(max_digits=18, decimal_places=2)
    productos_sin_rotacion = serializers.IntegerField()
    # Variación contra el período anterior del mismo largo. Null si el anterior
    # fue cero — ver _variacion_pct.
    var_ingresos_pct = serializers.FloatField(allow_null=True)
    var_egresos_pct = serializers.FloatField(allow_null=True)
    var_balance_pct = serializers.FloatField(allow_null=True)
    var_cantidad_pct = serializers.FloatField(allow_null=True)


class PanelSerieSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    egresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()
    ticket_promedio = serializers.DecimalField(max_digits=16, decimal_places=2)


class MetodoPagoSerializer(serializers.Serializer):
    metodo = serializers.CharField()
    monto = serializers.DecimalField(max_digits=16, decimal_places=2)
    pct = serializers.FloatField()


class TopClienteSerializer(serializers.Serializer):
    cliente = serializers.UUIDField(allow_null=True)
    nombre = serializers.CharField()
    ingresos = serializers.DecimalField(max_digits=16, decimal_places=2)
    cantidad_ventas = serializers.IntegerField()


class ActividadSerializer(serializers.Serializer):
    tipo = serializers.CharField()
    descripcion = serializers.CharField()
    detalle = serializers.CharField(allow_blank=True)
    fecha = serializers.DateField()
    monto = serializers.DecimalField(max_digits=16, decimal_places=2)
    # 1 entra plata, -1 sale.
    signo = serializers.IntegerField()


class PanelSerializer(serializers.Serializer):
    periodo = PanelPeriodoSerializer()
    kpis = PanelKpisSerializer()
    serie = PanelSerieSerializer(many=True)
    metodos_pago = MetodoPagoSerializer(many=True)
    top_clientes = TopClienteSerializer(many=True)
    por_hora = RentabilidadHoraSerializer(many=True)
    actividad = ActividadSerializer(many=True)
