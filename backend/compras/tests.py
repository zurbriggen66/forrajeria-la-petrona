"""
Registrar una compra tiene que sumar stock y actualizar el saldo del
proveedor (criterio de aceptación de la Fase 5).
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaMovimiento, CajaSesion
from core.models import Comercio, UsuarioComercio
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
