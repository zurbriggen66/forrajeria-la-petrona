from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import Comercio, UsuarioComercio
from productos.models import Producto

from .models import Deposito, StockDeposito

User = get_user_model()


class InventarioResumenTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        Producto.objects.create(
            comercio=self.comercio, nombre="Normal", stock=100, stock_minimo=10,
            precio_costo=Decimal("10"), precio_venta=Decimal("20"),
        )
        Producto.objects.create(
            comercio=self.comercio, nombre="Stock bajo", stock=5, stock_minimo=10,
            precio_costo=Decimal("10"), precio_venta=Decimal("20"),
        )
        Producto.objects.create(
            comercio=self.comercio, nombre="Sin stock", stock=0, stock_minimo=10,
            precio_costo=Decimal("10"), precio_venta=Decimal("20"),
        )
        # inactivo: no debe contar en los KPIs
        Producto.objects.create(
            comercio=self.comercio, nombre="Inactivo", stock=100, stock_minimo=10, activo=False,
            precio_costo=Decimal("10"), precio_venta=Decimal("20"),
        )

    def test_kpis_del_resumen(self):
        response = self.client.get("/api/inventario/resumen/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_productos"], 3)
        self.assertEqual(response.data["stock_bajo_count"], 1)
        self.assertEqual(response.data["sin_stock_count"], 1)
        self.assertEqual(Decimal(response.data["valor_stock_costo"]), Decimal("1050.00"))  # (100+5+0)*10

    def test_filtro_stock_bajo(self):
        response = self.client.get("/api/productos/?stock_status=bajo")
        nombres = [p["nombre"] for p in response.data["results"]]
        self.assertEqual(nombres, ["Stock bajo"])

    def test_filtro_sin_stock(self):
        response = self.client.get("/api/productos/?stock_status=sin_stock")
        nombres = [p["nombre"] for p in response.data["results"]]
        self.assertEqual(nombres, ["Sin stock"])

    def test_ranking_rentabilidad_ordena_por_margen(self):
        Producto.objects.create(
            comercio=self.comercio, nombre="Alto margen", stock=1, activo=True,
            precio_costo=Decimal("10"), precio_venta=Decimal("100"),
        )
        response = self.client.get("/api/inventario/ranking-rentabilidad/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["nombre"], "Alto margen")


class DepositoTransferenciaTests(APITestCase):
    """Fase 5: mover stock entre el local (central) y depósitos, sin perder
    ni duplicar unidades."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.deposito = Deposito.objects.create(comercio=self.comercio, nombre="Depósito Norte")
        self.producto = Producto.objects.create(comercio=self.comercio, nombre="Alimento", stock=Decimal("100"))

    def test_transferir_de_central_a_deposito(self):
        response = self.client.post("/api/inventario/stock-deposito/transferir/", {
            "producto": str(self.producto.id), "cantidad": "30",
            "origen": "central", "destino": str(self.deposito.id),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("70.000"))
        fila = StockDeposito.objects.get(deposito=self.deposito, producto=self.producto)
        self.assertEqual(fila.stock, Decimal("30.000"))

    def test_transferir_de_deposito_a_central(self):
        StockDeposito.objects.create(
            comercio=self.comercio, deposito=self.deposito, producto=self.producto, stock=Decimal("20"),
        )
        response = self.client.post("/api/inventario/stock-deposito/transferir/", {
            "producto": str(self.producto.id), "cantidad": "20",
            "origen": str(self.deposito.id), "destino": "central",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("120.000"))
        fila = StockDeposito.objects.get(deposito=self.deposito, producto=self.producto)
        self.assertEqual(fila.stock, Decimal("0.000"))

    def test_transferir_entre_dos_depositos(self):
        otro_deposito = Deposito.objects.create(comercio=self.comercio, nombre="Depósito Sur")
        StockDeposito.objects.create(
            comercio=self.comercio, deposito=self.deposito, producto=self.producto, stock=Decimal("50"),
        )
        response = self.client.post("/api/inventario/stock-deposito/transferir/", {
            "producto": str(self.producto.id), "cantidad": "50",
            "origen": str(self.deposito.id), "destino": str(otro_deposito.id),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("100.000"), "el central no se toca en una transferencia entre depósitos")
        self.assertEqual(StockDeposito.objects.get(deposito=self.deposito, producto=self.producto).stock, Decimal("0.000"))
        self.assertEqual(StockDeposito.objects.get(deposito=otro_deposito, producto=self.producto).stock, Decimal("50.000"))

    def test_no_permite_transferir_sin_stock_suficiente(self):
        response = self.client.post("/api/inventario/stock-deposito/transferir/", {
            "producto": str(self.producto.id), "cantidad": "9999",
            "origen": "central", "destino": str(self.deposito.id),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, Decimal("100.000"))

    def test_no_permite_origen_igual_a_destino(self):
        response = self.client.post("/api/inventario/stock-deposito/transferir/", {
            "producto": str(self.producto.id), "cantidad": "10", "origen": "central", "destino": "central",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_puede_transferir_producto_de_otro_comercio(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        ajeno = Producto.objects.create(comercio=otro_comercio, nombre="Ajeno", stock=Decimal("10"))
        response = self.client.post("/api/inventario/stock-deposito/transferir/", {
            "producto": str(ajeno.id), "cantidad": "1", "origen": "central", "destino": str(self.deposito.id),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
