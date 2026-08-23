"""
Panel de Estadísticas y Verdad del Negocio (Fase 4): los KPIs tienen que
cuadrar exactamente con las ventas registradas, y los filtros tienen que
filtrar de verdad.
"""
import uuid
from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from caja.models import CajaSesion, CuentaPago
from clientes.models import Cliente, ClienteMovimiento
from compras.models import Compra, CompraPago
from core.models import Comercio, Perfil, UsuarioComercio
from finanzas.models import Gasto
from productos.models import Producto
from proveedores.models import Proveedor
from repartos.models import Reparto
from ventas.models import Presupuesto, Venta, VentaItem

User = get_user_model()


class EstadisticasTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Distribuidora Sur")
        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", categoria="Bebidas", proveedor=self.proveedor,
            precio_costo=Decimal("100"), precio_venta=Decimal("200"), stock=Decimal("100"),
        )
        self.queso = Producto.objects.create(
            comercio=self.comercio, nombre="Queso", categoria="Lácteos",
            precio_costo=Decimal("500"), precio_venta=Decimal("800"), stock=Decimal("100"),
        )

    def _vender(self, producto, cantidad="1"):
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(producto.id), "cantidad": cantidad}],
        }, format="json")
        assert response.status_code == 201, response.data
        return Venta.objects.get(id=response.data["id"])

    def test_resumen_cuadra_con_las_ventas_registradas(self):
        self._vender(self.gaseosa, "2")   # 400
        self._vender(self.queso, "1")     # 800
        anulada = self._vender(self.gaseosa, "1")  # 200, se anula
        self.client.post(f"/api/ventas/{anulada.id}/anular/", {"motivo": "x"}, format="json")

        Gasto.objects.create(
            comercio=self.comercio, categoria="Insumos", monto=Decimal("150"),
            fecha=timezone.localtime(timezone.now()).date(),
        )

        response = self.client.get("/api/estadisticas/resumen/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("1200.00"), "no debe contar la venta anulada")
        self.assertEqual(response.data["cantidad_ventas"], 2)
        self.assertEqual(Decimal(response.data["egresos"]), Decimal("150.00"))
        self.assertEqual(Decimal(response.data["balance"]), Decimal("1050.00"))
        self.assertEqual(Decimal(response.data["ticket_promedio"]), Decimal("600.00"))
        # margen: (400-200)+(800-500) = 500 sobre 1200 de ingresos = 41.67%
        self.assertAlmostEqual(response.data["margen_pct"], 500 / 1200 * 100, places=2)

    def test_resumen_filtra_por_categoria(self):
        self._vender(self.gaseosa, "1")
        self._vender(self.queso, "1")

        response = self.client.get("/api/estadisticas/resumen/?categoria=Bebidas")
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("200.00"))
        self.assertEqual(response.data["cantidad_ventas"], 1)

    def test_resumen_filtra_por_rango_de_fechas(self):
        venta_vieja = self._vender(self.gaseosa, "1")
        Venta.objects.filter(id=venta_vieja.id).update(created_at=timezone.now() - timedelta(days=10))
        self._vender(self.queso, "1")

        # timezone.now().date() da la fecha en UTC, no la fecha local del
        # comercio (Buenos Aires) — de noche difieren. localtime() la corrige.
        hoy = timezone.localtime(timezone.now()).date().isoformat()
        response = self.client.get(f"/api/estadisticas/resumen/?fecha_desde={hoy}&fecha_hasta={hoy}")
        self.assertEqual(response.data["cantidad_ventas"], 1)
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("800.00"))

    def test_resumen_filtra_por_vendedor(self):
        otro_user = User.objects.create_user(username="otro", password="testpass123")
        UsuarioComercio.objects.create(user=otro_user, comercio=self.comercio, rol="Cajero")
        perfil_otro = Perfil.objects.filter(user=otro_user).first() or Perfil.objects.create(user=otro_user, comercio=self.comercio)

        self._vender(self.gaseosa, "1")  # vendedor = self.user
        self.client.force_authenticate(user=otro_user)
        self._vender(self.queso, "1")  # vendedor = otro_user
        self.client.force_authenticate(user=self.user)

        response = self.client.get(f"/api/estadisticas/resumen/?vendedor={perfil_otro.id}")
        self.assertEqual(response.data["cantidad_ventas"], 1)
        self.assertEqual(Decimal(response.data["ingresos"]), Decimal("800.00"))

    def test_rankings_top_productos_y_vendedores(self):
        self._vender(self.gaseosa, "5")  # 1000
        self._vender(self.queso, "1")    # 800

        response = self.client.get("/api/estadisticas/rankings/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["top_productos"][0]["nombre"], "Gaseosa")
        self.assertEqual(Decimal(response.data["top_productos"][0]["ingresos"]), Decimal("1000.00"))
        self.assertEqual(response.data["top_vendedores"][0]["cantidad_ventas"], 2)

    def test_rentabilidad_real_por_producto(self):
        self._vender(self.gaseosa, "2")  # ingresos 400, costo 200 -> 50%

        response = self.client.get("/api/estadisticas/rentabilidad/")
        fila = next(f for f in response.data if f["nombre"] == "Gaseosa")
        self.assertEqual(Decimal(fila["ingresos"]), Decimal("400.00"))
        self.assertEqual(Decimal(fila["costo"]), Decimal("200.00"))
        self.assertAlmostEqual(fila["margen_pct"], 50.0, places=2)

    def test_verdad_del_negocio_por_categoria_y_proveedor(self):
        self._vender(self.gaseosa, "1")  # Bebidas / Distribuidora Sur
        self._vender(self.queso, "1")    # Lácteos / sin proveedor

        response = self.client.get("/api/estadisticas/verdad-del-negocio/")
        self.assertEqual(response.status_code, 200, response.data)
        categorias = {f["categoria"] for f in response.data["por_categoria"]}
        self.assertEqual(categorias, {"Bebidas", "Lácteos"})
        proveedores = {f["nombre"] for f in response.data["por_proveedor"]}
        self.assertIn("Distribuidora Sur", proveedores)
        self.assertIn("Sin proveedor", proveedores)

    def test_verdad_del_negocio_comparativa_de_periodo(self):
        hoy = timezone.localtime(timezone.now()).date()
        venta_actual = self._vender(self.gaseosa, "1")  # 200
        venta_anterior = self._vender(self.queso, "1")  # 800
        Venta.objects.filter(id=venta_anterior.id).update(created_at=timezone.now() - timedelta(days=4))

        response = self.client.get(
            f"/api/estadisticas/verdad-del-negocio/?fecha_desde={(hoy - timedelta(days=2)).isoformat()}&fecha_hasta={hoy.isoformat()}"
        )
        self.assertEqual(response.status_code, 200, response.data)
        comparativa = response.data["comparativa"]
        self.assertEqual(Decimal(comparativa["periodo_actual"]["ingresos"]), Decimal("200.00"))
        self.assertEqual(Decimal(comparativa["periodo_anterior"]["ingresos"]), Decimal("800.00"))
        self.assertAlmostEqual(comparativa["variacion_ingresos_pct"], (200 - 800) / 800 * 100, places=2)

    def test_aislamiento_multi_tenant(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        otro_producto = Producto.objects.create(
            comercio=otro_comercio, nombre="Ajeno", precio_costo=Decimal("10"),
            precio_venta=Decimal("20"), stock=Decimal("10"),
        )
        VentaItem.objects.create(
            venta=Venta.objects.create(comercio=otro_comercio, total=Decimal("20")),
            producto=otro_producto, cantidad=1, precio_unitario=Decimal("20"),
            costo_unitario=Decimal("10"), subtotal=Decimal("20"),
        )

        response = self.client.get("/api/estadisticas/resumen/")
        self.assertEqual(response.data["cantidad_ventas"], 0)


class InicioTests(APITestCase):
    """Dashboard de Inicio. Lo que se testea acá es lo que no es obvio: el día
    local (no UTC), el relleno de días sin ventas en la serie del gráfico, y
    que cada bloque respete el comercio activo y el rol."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(
            user=self.user, comercio=self.comercio, nombre_completo="Dueño", rol="Dueño",
        )
        self.client.force_authenticate(user=self.user)
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", categoria="Bebidas",
            precio_costo=Decimal("100"), precio_venta=Decimal("200"), stock=Decimal("500"),
        )
        self.hoy = timezone.localtime(timezone.now()).date()

    def _vender(self, cantidad="1"):
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.gaseosa.id), "cantidad": cantidad}],
        }, format="json")
        assert response.status_code == 201, response.data
        return Venta.objects.get(id=response.data["id"])

    def _inicio(self):
        response = self.client.get("/api/estadisticas/inicio/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_serie_7dias_rellena_los_dias_sin_ventas(self):
        self._vender("2")  # 400 hoy
        vieja = self._vender("1")  # 200, se manda a hace 3 días
        Venta.objects.filter(id=vieja.id).update(
            created_at=timezone.now() - timedelta(days=3)
        )

        data = self._inicio()
        serie = data["serie_7dias"]
        self.assertEqual(len(serie), 7)
        # Días consecutivos terminando en hoy.
        esperadas = [(self.hoy - timedelta(days=6 - i)).isoformat() for i in range(7)]
        self.assertEqual([d["fecha"] for d in serie], esperadas)

        self.assertEqual(Decimal(serie[-1]["ingresos"]), Decimal("400.00"))
        self.assertEqual(Decimal(serie[-4]["ingresos"]), Decimal("200.00"))
        # Lo que protege al gráfico: los días muertos existen y valen cero,
        # no faltan ni vienen en null.
        for i in (0, 1, 2, 4, 5):
            self.assertEqual(Decimal(serie[i]["ingresos"]), Decimal("0"), f"día {i}")
            self.assertEqual(serie[i]["cantidad_ventas"], 0)

        # Ayer no vendió nada: la variación es None, no 0 ni infinito.
        self.assertIsNone(data["comparacion"]["variacion_ingresos_pct"])
        # Promedio sobre la ventana fija de 7 días: (400+200)/7.
        self.assertEqual(
            Decimal(data["comparacion"]["promedio_diario_7d"]),
            (Decimal("600") / 7).quantize(Decimal("0.01")),
        )

    def test_el_dia_es_el_local_no_el_utc(self):
        """A las 02:00 UTC todavía son las 23:00 de AYER en Buenos Aires (UTC-3).
        Si alguien cambia TruncDate por una extracción UTC cruda, esto se rompe."""
        venta = self._vender("1")  # 200
        instante = datetime.combine(self.hoy, time(2, 0), tzinfo=dt_timezone.utc)
        Venta.objects.filter(id=venta.id).update(created_at=instante)

        data = self._inicio()
        self.assertEqual(data["fecha"], self.hoy.isoformat())
        self.assertEqual(Decimal(data["hoy"]["ingresos"]), Decimal("0"), "no es de hoy en hora local")
        self.assertEqual(Decimal(data["ayer"]["ingresos"]), Decimal("200.00"))
        serie = {d["fecha"]: d for d in data["serie_7dias"]}
        ayer = (self.hoy - timedelta(days=1)).isoformat()
        self.assertEqual(Decimal(serie[ayer]["ingresos"]), Decimal("200.00"))

    def test_no_cuenta_ventas_anuladas(self):
        self._vender("2")  # 400
        anulada = self._vender("1")  # 200
        self.client.post(f"/api/ventas/{anulada.id}/anular/", {"motivo": "x"}, format="json")

        data = self._inicio()
        # Tres caminos distintos al mismo queryset, los tres tienen que excluirla.
        self.assertEqual(Decimal(data["hoy"]["ingresos"]), Decimal("400.00"))
        self.assertEqual(data["hoy"]["cantidad_ventas"], 1)
        self.assertEqual(Decimal(data["serie_7dias"][-1]["ingresos"]), Decimal("400.00"))
        self.assertEqual(Decimal(data["top_productos_hoy"][0]["cantidad"]), Decimal("2.000"))

    def test_pendientes_y_deudas(self):
        Reparto.objects.create(
            comercio=self.comercio, cliente_nombre="A", destino="x", fecha=self.hoy,
            estado="pendiente", total=Decimal("100"),
        )
        Reparto.objects.create(
            comercio=self.comercio, cliente_nombre="B", destino="x", fecha=self.hoy,
            estado="entregado", total=Decimal("100"),
        )
        Reparto.objects.create(
            comercio=self.comercio, cliente_nombre="C", destino="x",
            fecha=self.hoy - timedelta(days=1), estado="pendiente", total=Decimal("100"),
        )
        Presupuesto.objects.create(comercio=self.comercio, cliente_nombre="D", estado="pendiente")
        Presupuesto.objects.create(comercio=self.comercio, cliente_nombre="E", estado="aprobado")

        Producto.objects.create(
            comercio=self.comercio, nombre="Sin stock", precio_venta=Decimal("10"),
            stock=Decimal("0"), stock_minimo=Decimal("5"),
        )
        Producto.objects.create(
            comercio=self.comercio, nombre="Poco stock", precio_venta=Decimal("10"),
            stock=Decimal("2"), stock_minimo=Decimal("5"),
        )
        Cliente.objects.create(comercio=self.comercio, nombre="Debe", saldo_actual=Decimal("5000"))
        Cliente.objects.create(comercio=self.comercio, nombre="Al día", saldo_actual=Decimal("0"))
        Proveedor.objects.create(comercio=self.comercio, nombre="Prov", saldo_actual=Decimal("3000"))

        data = self._inicio()
        pendientes = data["pendientes"]
        self.assertEqual(pendientes["repartos_hoy"], 1, "el entregado de hoy no cuenta")
        self.assertEqual(pendientes["repartos_pendientes"], 2)
        self.assertEqual(pendientes["presupuestos_pendientes"], 1)
        self.assertEqual(pendientes["sin_stock"], 1)
        self.assertEqual(pendientes["stock_bajo"], 1, "sin stock no cuenta como stock bajo")
        self.assertEqual(pendientes["pedidos_sugeridos"], 2, "acá sí entran los dos")

        deudas = data["deudas"]
        self.assertEqual(Decimal(deudas["total_por_cobrar"]), Decimal("5000.00"))
        self.assertEqual(Decimal(deudas["total_por_pagar"]), Decimal("3000.00"))
        self.assertEqual([d["nombre"] for d in deudas["top_deudores"]], ["Debe"])

    def test_cajero_no_recibe_deudas_ni_balance(self):
        Cliente.objects.create(comercio=self.comercio, nombre="Debe", saldo_actual=Decimal("5000"))
        Gasto.objects.create(
            comercio=self.comercio, categoria="Insumos", monto=Decimal("150"), fecha=self.hoy,
        )
        self._vender("1")

        cajero = User.objects.create_user(username="cajero_inicio", password="testpass123")
        UsuarioComercio.objects.create(user=cajero, comercio=self.comercio, rol="Cajero")
        Perfil.objects.create(
            user=cajero, comercio=self.comercio, nombre_completo="Cajero", rol="Cajero",
        )
        self.client.force_authenticate(user=cajero)

        data = self._inicio()
        self.assertIsNone(data["deudas"], "el cajero no ve la plata en la calle")
        self.assertIsNone(data["hoy"]["egresos"])
        self.assertIsNone(data["hoy"]["balance"])
        # Lo operativo sí lo ve.
        self.assertEqual(Decimal(data["hoy"]["ingresos"]), Decimal("200.00"))
        self.assertEqual(len(data["serie_7dias"]), 7)

    def test_aislamiento_multi_tenant(self):
        otro = Comercio.objects.create(nombre="Otro (test)")
        otro_producto = Producto.objects.create(
            comercio=otro, nombre="Ajeno", precio_costo=Decimal("10"),
            precio_venta=Decimal("20"), stock=Decimal("10"),
        )
        VentaItem.objects.create(
            venta=Venta.objects.create(comercio=otro, total=Decimal("20")),
            producto=otro_producto, cantidad=1, precio_unitario=Decimal("20"),
            costo_unitario=Decimal("10"), subtotal=Decimal("20"),
        )
        Cliente.objects.create(comercio=otro, nombre="Deudor ajeno", saldo_actual=Decimal("9999"))
        Reparto.objects.create(
            comercio=otro, cliente_nombre="Ajeno", destino="x", fecha=self.hoy,
            estado="pendiente", total=Decimal("100"),
        )

        data = self._inicio()
        # Cada bloque arma su propio queryset, así que la fuga es un riesgo por bloque.
        self.assertEqual(data["hoy"]["cantidad_ventas"], 0)
        self.assertEqual(Decimal(data["deudas"]["total_por_cobrar"]), Decimal("0"))
        self.assertEqual(data["pendientes"]["repartos_pendientes"], 0)
        self.assertEqual(data["top_productos_hoy"], [])


class ContabilidadTests(APITestCase):
    """Lo contable: que Resultado y Flujo de caja den distinto cuando tienen
    que dar distinto, y que el puente entre los dos cierre exacto."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="conta", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="D", rol="Dueño")
        self.client.force_authenticate(user=self.user)
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.efectivo = CuentaPago.objects.create(
            comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        # Cuesta 600, se vende a 1000 -> deja 400 de margen por unidad.
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado", categoria="Balanceados",
            precio_costo=Decimal("600"), precio_venta=Decimal("1000"), stock=Decimal("100"),
        )
        self.hoy = timezone.localtime(timezone.now()).date()

    def _vender(self, cantidad="1", cliente=None, fiado=None):
        payload = {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.producto.id), "cantidad": cantidad}],
            "cuenta_pago": str(self.efectivo.id),
        }
        if cliente:
            payload["cliente"] = str(cliente.id)
        if fiado:
            payload["monto_cuenta_corriente"] = fiado
        r = self.client.post("/api/ventas/", payload, format="json")
        assert r.status_code == 201, r.data
        return r.data

    def _resultado(self):
        r = self.client.get("/api/estadisticas/contabilidad/resultado/")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def test_resultado_descuenta_el_costo_de_lo_vendido_y_los_gastos(self):
        self._vender("10")   # 10.000 de venta, 6.000 de costo
        Gasto.objects.create(comercio=self.comercio, categoria="Alquiler",
                             monto=Decimal("1000"), fecha=self.hoy, tipo="fijo")
        Gasto.objects.create(comercio=self.comercio, categoria="Insumos",
                             monto=Decimal("500"), fecha=self.hoy, tipo="variable")

        res = self._resultado()["resultado"]
        self.assertEqual(Decimal(res["ingresos"]), Decimal("10000.00"))
        self.assertEqual(Decimal(res["cmv"]), Decimal("6000.00"))
        self.assertEqual(Decimal(res["margen_bruto"]), Decimal("4000.00"))
        self.assertEqual(Decimal(res["gastos_fijos"]), Decimal("1000.00"))
        self.assertEqual(Decimal(res["gastos_variables"]), Decimal("500.00"))
        self.assertEqual(Decimal(res["resultado"]), Decimal("2500.00"))

    def test_comprar_stock_no_es_gasto_del_resultado_pero_si_sale_de_la_caja(self):
        """El punto de toda la sección: comprar mercadería no te hace perder
        plata, te cambia plata por stock. Pero la caja sí lo siente."""
        self._vender("10")  # deja 4.000 de margen, sin gastos
        proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Molino")
        compra = Compra.objects.create(
            comercio=self.comercio, proveedor=proveedor, fecha=self.hoy,
            total=Decimal("3000"), pagado=False)
        CompraPago.objects.create(
            comercio=self.comercio, compra=compra, fecha=self.hoy, monto=Decimal("3000"))

        data = self._resultado()
        self.assertEqual(Decimal(data["resultado"]["resultado"]), Decimal("4000.00"),
                         "la compra de stock no baja el resultado")
        self.assertEqual(Decimal(data["flujo"]["pagos_proveedor"]), Decimal("3000.00"))
        # Caja: entraron 10.000, salieron 3.000.
        self.assertEqual(Decimal(data["flujo"]["flujo_neto"]), Decimal("7000.00"))

    def test_la_venta_fiada_suma_al_resultado_pero_no_a_la_caja(self):
        cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Fiado", limite_credito=Decimal("100000"))
        self._vender("10", cliente=cliente, fiado="10000")

        data = self._resultado()
        self.assertEqual(Decimal(data["resultado"]["ingresos"]), Decimal("10000.00"))
        self.assertEqual(Decimal(data["flujo"]["cobrado_ventas"]), Decimal("0.00"),
                         "no entró plata: se fió todo")
        self.assertEqual(Decimal(data["flujo"]["flujo_neto"]), Decimal("0.00"))

    def test_el_puente_entre_resultado_y_caja_cierra_exacto(self):
        """flujo = resultado - fiado + cobros_cc + cmv - pagos_proveedor.
        Si algún día se agrega un concepto y no se suma al puente, esto avisa."""
        cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Mixto", limite_credito=Decimal("100000"))
        self._vender("5")                                  # 5.000 cobrados
        self._vender("5", cliente=cliente, fiado="5000")   # 5.000 fiados
        Gasto.objects.create(comercio=self.comercio, categoria="Luz",
                             monto=Decimal("800"), fecha=self.hoy, tipo="fijo")
        proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Molino")
        compra = Compra.objects.create(comercio=self.comercio, proveedor=proveedor,
                                       fecha=self.hoy, total=Decimal("2000"), pagado=False)
        CompraPago.objects.create(comercio=self.comercio, compra=compra,
                                  fecha=self.hoy, monto=Decimal("2000"))

        c = self._resultado()["conciliacion"]
        puente = (
            Decimal(c["resultado"]) - Decimal(c["ventas_fiadas"])
            + Decimal(c["cobros_cuenta_corriente"]) + Decimal(c["cmv"])
            - Decimal(c["pagos_proveedor"])
        )
        self.assertEqual(puente, Decimal(c["flujo_neto"]))

    def test_punto_de_equilibrio(self):
        self._vender("10")  # margen 40%
        Gasto.objects.create(comercio=self.comercio, categoria="Alquiler",
                             monto=Decimal("2000"), fecha=self.hoy, tipo="fijo")

        eq = self._resultado()["equilibrio"]
        self.assertTrue(eq["alcanzable"])
        # 2.000 de fijos / 40% de margen = hay que vender 5.000
        self.assertEqual(Decimal(eq["venta_necesaria"]), Decimal("5000.00"))
        self.assertEqual(Decimal(eq["diferencia"]), Decimal("5000.00"), "vendió 10.000, le sobran 5.000")

    def test_deudas_por_antiguedad_usa_la_fecha_del_cargo_impago(self):
        cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Moroso", limite_credito=Decimal("999999"))
        viejo = ClienteMovimiento.objects.create(
            comercio=self.comercio, cliente=cliente, tipo="cargo", monto=Decimal("5000"))
        ClienteMovimiento.objects.filter(pk=viejo.pk).update(
            created_at=timezone.now() - timedelta(days=100))
        cliente.saldo_actual = Decimal("5000")
        cliente.save(update_fields=["saldo_actual"])

        r = self.client.get("/api/estadisticas/contabilidad/deudas/")
        self.assertEqual(r.status_code, 200, r.data)
        tramos = r.data["por_cobrar"]["tramos"]
        self.assertEqual(Decimal(tramos["mas_90"]), Decimal("5000.00"))
        self.assertEqual(Decimal(tramos["al_dia"]), Decimal("0"))

    def test_los_pagos_saldan_primero_los_cargos_mas_viejos(self):
        """FIFO: si pagó algo, lo que queda debiendo es lo más nuevo."""
        cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Paga a cuenta", limite_credito=Decimal("999999"))
        viejo = ClienteMovimiento.objects.create(
            comercio=self.comercio, cliente=cliente, tipo="cargo", monto=Decimal("3000"))
        ClienteMovimiento.objects.filter(pk=viejo.pk).update(
            created_at=timezone.now() - timedelta(days=100))
        ClienteMovimiento.objects.create(
            comercio=self.comercio, cliente=cliente, tipo="cargo", monto=Decimal("2000"))
        ClienteMovimiento.objects.create(
            comercio=self.comercio, cliente=cliente, tipo="pago", monto=Decimal("3000"))
        cliente.saldo_actual = Decimal("2000")
        cliente.save(update_fields=["saldo_actual"])

        r = self.client.get("/api/estadisticas/contabilidad/deudas/")
        tramos = r.data["por_cobrar"]["tramos"]
        self.assertEqual(Decimal(tramos["mas_90"]), Decimal("0"), "el cargo viejo quedó saldado")
        self.assertEqual(Decimal(tramos["al_dia"]), Decimal("2000.00"))

    def test_mensual_devuelve_la_serie_completa(self):
        self._vender("10")
        r = self.client.get("/api/estadisticas/contabilidad/mensual/?meses=6")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(r.data["meses"]), 6, "incluye los meses sin ventas")
        actual = r.data["meses"][-1]
        self.assertEqual(Decimal(actual["ingresos"]), Decimal("10000.00"))
        self.assertEqual(Decimal(actual["margen_bruto"]), Decimal("4000.00"))

    def test_aislamiento_multi_tenant(self):
        otro = Comercio.objects.create(nombre="Otro (test)")
        Cliente.objects.create(comercio=otro, nombre="Ajeno", saldo_actual=Decimal("9999"))
        r = self.client.get("/api/estadisticas/contabilidad/deudas/")
        self.assertEqual(Decimal(r.data["por_cobrar"]["total"]), Decimal("0"))
