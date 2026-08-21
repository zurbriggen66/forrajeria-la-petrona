"""
Prueba de aislamiento multi-tenant: un usuario del comercio A no debe poder
leer ni escribir datos del comercio B a través de la API, aunque conozca el id.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import Comercio, Perfil, UsuarioComercio
from ventas.models import Venta, VentaItem
from .models import AjustePrecio, Combo, ComboItem, Producto, ProductoUniversal

User = get_user_model()


class AislamientoMultiTenantTests(APITestCase):
    def setUp(self):
        self.comercio_a = Comercio.objects.create(nombre="Comercio A (test)")
        self.comercio_b = Comercio.objects.create(nombre="Comercio B (test)")

        self.user_a = User.objects.create_user(username="user_a", password="testpass123")
        UsuarioComercio.objects.create(user=self.user_a, comercio=self.comercio_a, rol="Dueño")

        self.user_b = User.objects.create_user(username="user_b", password="testpass123")
        UsuarioComercio.objects.create(user=self.user_b, comercio=self.comercio_b, rol="Dueño")

        self.producto_a = Producto.objects.create(
            comercio=self.comercio_a, nombre="Producto de A", precio_venta=100
        )
        self.producto_b = Producto.objects.create(
            comercio=self.comercio_b, nombre="Producto de B", precio_venta=200
        )

    def _login(self, username):
        self.client.force_authenticate(user=User.objects.get(username=username))

    def test_listado_solo_muestra_productos_del_propio_comercio(self):
        self._login("user_a")
        response = self.client.get("/api/productos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [p["id"] for p in response.data["results"]]
        self.assertIn(str(self.producto_a.id), ids)
        self.assertNotIn(str(self.producto_b.id), ids)

    def test_no_puede_leer_detalle_de_otro_comercio(self):
        self._login("user_a")
        response = self.client.get(f"/api/productos/{self.producto_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_no_puede_escribir_en_producto_de_otro_comercio(self):
        self._login("user_a")
        response = self.client.patch(
            f"/api/productos/{self.producto_b.id}/", {"nombre": "hackeado"}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.producto_b.refresh_from_db()
        self.assertEqual(self.producto_b.nombre, "Producto de B")

    def test_comercio_se_asigna_en_servidor_no_por_el_cliente(self):
        """Aunque el body intente mandar un comercio distinto, se ignora: el
        servidor siempre usa el comercio resuelto de UsuarioComercio."""
        self._login("user_a")
        response = self.client.post(
            "/api/productos/",
            {"nombre": "Nuevo", "precio_venta": "50", "comercio": str(self.comercio_b.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        creado = Producto.objects.get(id=response.data["id"])
        self.assertEqual(creado.comercio_id, self.comercio_a.id)

    def test_usuario_sin_comercio_no_puede_operar(self):
        User.objects.create_user(username="user_c", password="testpass123")
        self._login("user_c")
        response = self.client.get("/api/productos/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AltaProductoAutocompletadoTests(APITestCase):
    """Alta de producto con autocompletado por código de barras (Fase 1)."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        ProductoUniversal.objects.create(
            codigo_barras="7791234000012", nombre="Coca-Cola 1.5L", categoria="Bebidas", marca="Coca-Cola",
        )

    def test_busca_por_codigo_de_barras_exacto(self):
        response = self.client.get("/api/productos-universal/?codigo_barras=7791234000012")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["nombre"], "Coca-Cola 1.5L")

    def test_codigo_inexistente_no_rompe_devuelve_vacio(self):
        response = self.client.get("/api/productos-universal/?codigo_barras=0000000000000")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_alta_de_producto_real(self):
        response = self.client.post("/api/productos/", {
            "codigo_barras": "7791234000012",
            "nombre": "Coca-Cola 1.5L",
            "categoria": "Bebidas",
            "precio_costo": "800",
            "precio_venta": "1200",
            "stock": "50",
            "stock_minimo": "5",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        producto = Producto.objects.get(id=response.data["id"])
        self.assertEqual(producto.comercio_id, self.comercio.id)
        self.assertEqual(response.data["margen_pct"], round((1200 - 800) / 1200 * 100, 2))


class AjustePrecioMasivoTests(APITestCase):
    """Aumento masivo de precios + historial (Fase 1, criterio de aceptación)."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.otro_comercio = Comercio.objects.create(nombre="Otro comercio (test)")

        self.user = User.objects.create_user(username="dueno", password="testpass123")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Dueño Test", rol="Dueño")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.bebida = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", categoria="Bebidas", precio_venta=Decimal("100.00"),
        )
        self.almacen = Producto.objects.create(
            comercio=self.comercio, nombre="Fideos", categoria="Almacén", precio_venta=Decimal("200.00"),
        )
        self.producto_otro_comercio = Producto.objects.create(
            comercio=self.otro_comercio, nombre="Ajeno", categoria="Bebidas", precio_venta=Decimal("100.00"),
        )

    def test_aplica_porcentaje_solo_a_la_categoria_filtrada(self):
        response = self.client.post("/api/ajustes-precios/", {
            "descripcion": "Aumento bebidas",
            "tipo": "porcentaje",
            "valor": "10",
            "categoria": "Bebidas",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["cant_productos"], 1)

        self.bebida.refresh_from_db()
        self.almacen.refresh_from_db()
        self.assertEqual(self.bebida.precio_venta, Decimal("110.00"))
        self.assertEqual(self.almacen.precio_venta, Decimal("200.00"), "no debía tocar otra categoría")

    def test_no_afecta_productos_de_otro_comercio(self):
        self.client.post("/api/ajustes-precios/", {
            "tipo": "porcentaje", "valor": "50", "categoria": "Bebidas",
        })
        self.producto_otro_comercio.refresh_from_db()
        self.assertEqual(self.producto_otro_comercio.precio_venta, Decimal("100.00"))

    def test_queda_registrado_en_el_historial(self):
        self.client.post("/api/ajustes-precios/", {
            "descripcion": "Aumento general", "tipo": "monto", "valor": "15",
        })
        self.assertEqual(AjustePrecio.objects.filter(comercio=self.comercio).count(), 1)
        response = self.client.get("/api/ajustes-precios/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["descripcion"], "Aumento general")
        self.assertEqual(response.data["results"][0]["cant_productos"], 2)


class ComboTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.p1 = Producto.objects.create(comercio=self.comercio, nombre="Pan", precio_venta=500)
        self.p2 = Producto.objects.create(comercio=self.comercio, nombre="Jamón", precio_venta=1500)

    def test_crea_combo_con_items_anidados(self):
        response = self.client.post("/api/combos/", {
            "nombre": "Combo sandwich",
            "precio": "1800",
            "items": [
                {"producto": str(self.p1.id), "cantidad": "2"},
                {"producto": str(self.p2.id), "cantidad": "1"},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        combo = Combo.objects.get(id=response.data["id"])
        self.assertEqual(combo.items.count(), 2)
        self.assertEqual(combo.comercio_id, self.comercio.id)


class EliminarProductoTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def test_borra_de_verdad_un_producto_sin_historial(self):
        producto = Producto.objects.create(comercio=self.comercio, nombre="Sin ventas", precio_venta=100)
        response = self.client.delete(f"/api/productos/{producto.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Producto.objects.filter(id=producto.id).exists())

    def test_desactiva_en_vez_de_borrar_un_producto_con_ventas(self):
        producto = Producto.objects.create(comercio=self.comercio, nombre="Con ventas", precio_venta=100)
        venta = Venta.objects.create(comercio=self.comercio, total=100)
        VentaItem.objects.create(venta=venta, producto=producto, cantidad=1, precio_unitario=100, subtotal=100)

        response = self.client.delete(f"/api/productos/{producto.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        producto.refresh_from_db()
        self.assertFalse(producto.activo)
        # El ticket viejo sigue apuntando al producto (no se pierde el nombre).
        venta_item = VentaItem.objects.get(venta=venta)
        self.assertEqual(venta_item.producto_id, producto.id)

    def test_desactiva_en_vez_de_borrar_un_producto_en_un_combo(self):
        producto = Producto.objects.create(comercio=self.comercio, nombre="En combo", precio_venta=100)
        combo = Combo.objects.create(comercio=self.comercio, nombre="Combo", precio=100)
        ComboItem.objects.create(combo=combo, producto=producto, cantidad=1)

        response = self.client.delete(f"/api/productos/{producto.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        producto.refresh_from_db()
        self.assertFalse(producto.activo)
        self.assertEqual(combo.items.count(), 1)
