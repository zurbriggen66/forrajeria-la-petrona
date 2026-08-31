"""
Registrar una compra tiene que sumar stock y actualizar el saldo del
proveedor (criterio de aceptación de la Fase 5).
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaMovimiento, CajaSesion
from core.models import Comercio, Perfil, UsuarioComercio
from productos.models import Producto
from proveedores.models import Proveedor, ProveedorMovimiento

from .models import Compra

User = get_user_model()


class CompraTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Distribuidora Sur")
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", stock=Decimal("10"),
            precio_costo=Decimal("100"), precio_venta=Decimal("200"),
        )

    def _payload(self, **overrides):
        payload = {
            "proveedor": str(self.proveedor.id),
            "numero_factura": "A-0001",
            "fecha": "2026-08-11",
            "items": [{"producto": str(self.producto.id), "cantidad": "5", "costo_unitario": "120"}],
        }
        payload.update(overrides)
        return payload

    def test_compra_suma_stock_y_actualiza_precio_costo(self):
        response = self.client.post("/api/compras/", self._payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("600.00"))

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("15.000"))
        self.assertEqual(self.producto.precio_costo, Decimal("120.00"))

    def test_compra_sin_pagar_genera_deuda_en_cuenta_corriente(self):
        self.client.post("/api/compras/", self._payload(), format="json")
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.saldo_actual, Decimal("600.00"))
        self.assertTrue(ProveedorMovimiento.objects.filter(proveedor=self.proveedor, tipo="compra").exists())
        self.assertFalse(ProveedorMovimiento.objects.filter(proveedor=self.proveedor, tipo="pago").exists())

    def test_compra_pagada_no_deja_deuda_pendiente(self):
        response = self.client.post("/api/compras/", self._payload(pagado=True), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.saldo_actual, Decimal("0.00"), "compra + pago tienen que netear a cero")
        self.assertTrue(ProveedorMovimiento.objects.filter(proveedor=self.proveedor, tipo="compra").exists())
        self.assertTrue(ProveedorMovimiento.objects.filter(proveedor=self.proveedor, tipo="pago").exists())

    def test_compra_pagada_con_caja_abierta_genera_egreso(self):
        sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta", monto_apertura=Decimal("1000"))
        response = self.client.post("/api/compras/", self._payload(pagado=True), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(str(response.data["caja_sesion"]), str(sesion.id))

        movimiento = CajaMovimiento.objects.get(sesion=sesion, tipo="egreso")
        self.assertEqual(movimiento.monto, Decimal("600.00"))

    def test_compra_pagada_sin_caja_abierta_no_rompe(self):
        response = self.client.post("/api/compras/", self._payload(pagado=True), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["caja_sesion"])
        self.assertFalse(CajaMovimiento.objects.exists())

    def test_compra_sin_proveedor_solo_actualiza_stock(self):
        response = self.client.post("/api/compras/", self._payload(proveedor=None), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("15.000"))
        self.assertFalse(ProveedorMovimiento.objects.exists())

    def test_no_puede_comprar_producto_de_otro_comercio(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        ajeno = Producto.objects.create(comercio=otro_comercio, nombre="Ajeno", stock=Decimal("10"))
        response = self.client.post("/api/compras/", self._payload(
            items=[{"producto": str(ajeno.id), "cantidad": "1", "costo_unitario": "10"}],
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        ajeno.refresh_from_db()
        self.assertEqual(ajeno.stock, Decimal("10.000"))

    def test_aislamiento_multi_tenant_de_compras(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        Compra.objects.create(comercio=otro_comercio, fecha="2026-08-11", total=Decimal("999"))

        response = self.client.get("/api/compras/")
        self.assertEqual(response.data["count"], 0)

    def test_filtro_por_rango_de_fechas(self):
        self.client.post("/api/compras/", self._payload(fecha="2026-08-11"), format="json")
        self.client.post("/api/compras/", self._payload(fecha="2026-07-01"), format="json")

        dentro = self.client.get("/api/compras/?fecha_desde=2026-08-01&fecha_hasta=2026-08-31")
        fuera = self.client.get("/api/compras/?fecha_desde=2026-01-01&fecha_hasta=2026-01-31")
        self.assertEqual(dentro.data["count"], 1)
        self.assertEqual(fuera.data["count"], 0)


class CompraFiadaTests(APITestCase):
    """Compra a proveedor "fiada": la mercadería llega el 23/08 pero se paga el
    15/09. Lo que importa es que el egreso cuente el día del pago, no el de la
    entrega, y que se pueda pagar en varias veces."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(
            user=self.user, comercio=self.comercio, nombre_completo="Dueño", rol="Dueño",
        )
        self.client.force_authenticate(user=self.user)

        self.proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Distribuidora Sur")
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", stock=Decimal("10"),
            precio_costo=Decimal("100"), precio_venta=Decimal("200"),
        )

    def _comprar_fiado(self):
        """Compra de $600 entregada el 23/08, a pagar el 15/09."""
        response = self.client.post("/api/compras/", {
            "proveedor": str(self.proveedor.id),
            "numero_factura": "A-0001",
            "fecha": "2026-08-23",
            "fecha_vencimiento": "2026-09-15",
            "pagado": False,
            "items": [{"producto": str(self.producto.id), "cantidad": "5", "costo_unitario": "120"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def test_compra_fiada_entra_stock_y_deuda_pero_no_toca_la_caja(self):
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta")
        compra = self._comprar_fiado()

        self.assertEqual(compra["estado"], "pendiente")
        self.assertEqual(Decimal(compra["saldo_pendiente"]), Decimal("600.00"))
        self.assertEqual(compra["fecha_vencimiento"], "2026-09-15")
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("15.000"), "la mercadería sí entró")
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.saldo_actual, Decimal("600.00"))
        # Todavía no salió un peso.
        self.assertFalse(CajaMovimiento.objects.exists())

    def test_el_egreso_cuenta_el_dia_del_pago_no_el_de_la_entrega(self):
        compra = self._comprar_fiado()
        response = self.client.post(f"/api/compras/{compra['id']}/pagar/", {
            "fecha": "2026-09-15", "monto": "600",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        # El día que llegó la mercadería no hay egreso…
        entrega = self.client.get("/api/estadisticas/resumen/?fecha_desde=2026-08-23&fecha_hasta=2026-08-23")
        self.assertEqual(Decimal(entrega.data["egresos"]), Decimal("0.00"))
        # …y el día que pagó, sí.
        pago = self.client.get("/api/estadisticas/resumen/?fecha_desde=2026-09-15&fecha_hasta=2026-09-15")
        self.assertEqual(Decimal(pago.data["egresos"]), Decimal("600.00"))

    def test_pagos_parciales_van_saldando_la_compra(self):
        compra = self._comprar_fiado()
        url = f"/api/compras/{compra['id']}/pagar/"

        primero = self.client.post(url, {"fecha": "2026-09-15", "monto": "200"}, format="json")
        self.assertEqual(primero.status_code, status.HTTP_201_CREATED, primero.data)
        self.assertEqual(primero.data["compra"]["estado"], "parcial")
        self.assertEqual(Decimal(primero.data["compra"]["saldo_pendiente"]), Decimal("400.00"))
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.saldo_actual, Decimal("400.00"))

        segundo = self.client.post(url, {"fecha": "2026-09-30", "monto": "400"}, format="json")
        self.assertEqual(segundo.status_code, status.HTTP_201_CREATED, segundo.data)
        self.assertEqual(segundo.data["compra"]["estado"], "pagada")
        self.assertEqual(Decimal(segundo.data["compra"]["saldo_pendiente"]), Decimal("0.00"))
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.saldo_actual, Decimal("0.00"))

        # Cada pago pesa en su propio mes.
        septiembre = self.client.get("/api/estadisticas/resumen/?fecha_desde=2026-09-01&fecha_hasta=2026-09-20")
        self.assertEqual(Decimal(septiembre.data["egresos"]), Decimal("200.00"))

    def test_no_se_puede_pagar_de_mas_ni_pagar_dos_veces(self):
        compra = self._comprar_fiado()
        url = f"/api/compras/{compra['id']}/pagar/"

        excedido = self.client.post(url, {"fecha": "2026-09-15", "monto": "700"}, format="json")
        self.assertEqual(excedido.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.post(url, {"fecha": "2026-09-15", "monto": "600"}, format="json")
        repetido = self.client.post(url, {"fecha": "2026-09-16", "monto": "1"}, format="json")
        self.assertEqual(repetido.status_code, status.HTTP_400_BAD_REQUEST, "ya está saldada")

    def test_el_pago_sale_de_la_caja_abierta(self):
        sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")
        compra = self._comprar_fiado()
        self.client.post(f"/api/compras/{compra['id']}/pagar/", {
            "fecha": "2026-09-15", "monto": "600",
        }, format="json")

        movimiento = CajaMovimiento.objects.get(sesion=sesion, tipo="egreso")
        self.assertEqual(movimiento.monto, Decimal("600.00"))

    def test_inicio_cuenta_las_facturas_por_pagar_y_las_vencidas(self):
        self._comprar_fiado()  # vence 15/09/2026, ya pasó respecto de "hoy" real
        response = self.client.get("/api/estadisticas/inicio/")
        pendientes = response.data["pendientes"]
        self.assertEqual(pendientes["facturas_por_pagar"], 1)
        vencida = date(2026, 9, 15) < timezone.localtime(timezone.now()).date()
        self.assertEqual(pendientes["facturas_vencidas"], 1 if vencida else 0)


class UltimaCompraDeProductoTests(APITestCase):
    """El costo de la última compra, que es lo que el formulario muestra al lado
    de lo que se está cargando para que se vea si el proveedor aumentó."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.otro = Comercio.objects.create(nombre="Otro comercio (test)")
        self.user = User.objects.create_user(username="dueno-ultima", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Distribuidora Sur")
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Sahumerio", stock=Decimal("0"),
            precio_costo=Decimal("0"), precio_venta=Decimal("100"),
        )

    def _comprar(self, fecha, costo, cantidad="10"):
        return self.client.post("/api/compras/", {
            "proveedor": str(self.proveedor.id),
            "fecha": fecha,
            "items": [{"producto": str(self.producto.id), "cantidad": cantidad, "costo_unitario": costo}],
        }, format="json")

    def _ultima(self, producto_id=None):
        return self.client.get("/api/compras/ultima-de-producto/", {"producto": producto_id or str(self.producto.id)})

    def test_sin_compras_devuelve_null(self):
        response = self._ultima()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data)

    def test_devuelve_la_mas_reciente_por_fecha_no_por_orden_de_carga(self):
        """Se puede cargar hoy una factura de la semana pasada: manda la fecha
        de la compra, no cuándo se tipeó."""
        self.assertEqual(self._comprar("2026-03-06", "1422.76").status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._comprar("2026-08-20", "1800.50").status_code, status.HTTP_201_CREATED)
        # Cargada última pero con fecha vieja: no tiene que ganar.
        self.assertEqual(self._comprar("2026-01-02", "900").status_code, status.HTTP_201_CREATED)

        datos = self._ultima().data
        self.assertEqual(datos["fecha"], date(2026, 8, 20))
        self.assertEqual(Decimal(datos["costo_unitario"]), Decimal("1800.5000"))
        self.assertEqual(Decimal(datos["cantidad"]), Decimal("10.000"))
        self.assertEqual(datos["proveedor_nombre"], "Distribuidora Sur")

    def test_no_ve_compras_de_otro_comercio(self):
        ajeno = Producto.objects.create(
            comercio=self.otro, nombre="Ajeno", stock=Decimal("0"),
            precio_costo=Decimal("0"), precio_venta=Decimal("1"),
        )
        Compra.objects.create(comercio=self.otro, fecha=date(2026, 8, 20), total=Decimal("500"))
        response = self._ultima(producto_id=str(ajeno.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data)

    def test_sin_producto_es_400_y_no_500(self):
        response = self.client.get("/api/compras/ultima-de-producto/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_acepta_el_costo_de_4_decimales_que_precarga_el_formulario(self):
        """Producto.precio_costo tiene 4 decimales y el formulario lo precarga
        tal cual. Con costo_unitario en 2, elegir un producto y guardar sin
        tocar nada hacía rechazar la compra entera."""
        response = self._comprar("2026-08-20", "2200.0000", cantidad="1")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("2200.00"))
