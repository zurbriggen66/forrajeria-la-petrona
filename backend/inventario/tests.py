from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import Comercio, UsuarioComercio
from productos.models import Producto

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
