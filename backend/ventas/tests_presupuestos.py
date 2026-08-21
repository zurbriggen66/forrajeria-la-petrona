from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Comercio, UsuarioComercio
from productos.models import Producto

from .models import Presupuesto

User = get_user_model()


class PresupuestoTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        # Balanceado: $2.000/kg suelto, bolsa de 20kg a $10.000.
        self.balanceado = Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado perro", precio_venta=2000, precio_costo=400,
            venta_por_peso=True, unidad_medida="kg", bolsa_kg=20, precio_bolsa=10000, stock=500,
        )

    def _payload(self, **overrides):
        payload = {
            "cliente_nombre": "Juan Pérez",
            "numero": "P-0001",
            "validez": "2026-09-01",
            "descuento": "0",
            "items": [{"producto": str(self.balanceado.id), "cantidad": "2", "es_bolsa": True}],
        }
        payload.update(overrides)
        return payload

    def test_crea_presupuesto_y_calcula_total_con_descuento(self):
        response = self.client.post("/api/presupuestos/", self._payload(descuento="2000"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # 2 bolsas x $10.000 = 20.000 − 2.000 descuento = 18.000
        self.assertEqual(Decimal(response.data["subtotal"]), Decimal("20000.00"))
        self.assertEqual(Decimal(response.data["total"]), Decimal("18000.00"))
        self.assertEqual(response.data["estado"], "pendiente")

    def test_cobra_el_precio_suelto_cuando_no_es_bolsa(self):
        response = self.client.post("/api/presupuestos/", self._payload(
            items=[{"producto": str(self.balanceado.id), "cantidad": "3.5", "es_bolsa": False}],
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # 3,5kg x $2.000 = $7.000 (precio suelto, no el de bolsa)
        self.assertEqual(Decimal(response.data["total"]), Decimal("7000.00"))

    def test_no_mueve_el_stock_del_producto(self):
        self.client.post("/api/presupuestos/", self._payload(), format="json")
        self.balanceado.refresh_from_db()
        self.assertEqual(self.balanceado.stock, Decimal("500.000"))

    def test_rechaza_presupuesto_sin_productos(self):
        response = self.client.post("/api/presupuestos/", self._payload(items=[]), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechaza_descuento_mayor_al_subtotal(self):
        response = self.client.post("/api/presupuestos/", self._payload(descuento="999999"), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("descuento", response.data)

    def test_cambiar_estado(self):
        creado = self.client.post("/api/presupuestos/", self._payload(), format="json")
        presupuesto_id = creado.data["id"]
        response = self.client.post(f"/api/presupuestos/{presupuesto_id}/estado/", {"estado": "aprobado"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Presupuesto.objects.get(id=presupuesto_id).estado, "aprobado")

    def test_editar_reemplaza_los_items_y_recalcula(self):
        creado = self.client.post("/api/presupuestos/", self._payload(), format="json")
        presupuesto_id = creado.data["id"]
        response = self.client.put(f"/api/presupuestos/{presupuesto_id}/", self._payload(
            items=[{"producto": str(self.balanceado.id), "cantidad": "1", "es_bolsa": True}],
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("10000.00"))
        self.assertEqual(Presupuesto.objects.get(id=presupuesto_id).items.count(), 1)

    def test_no_ve_presupuestos_de_otro_comercio(self):
        otro = Comercio.objects.create(nombre="Otro comercio")
        Presupuesto.objects.create(comercio=otro, cliente_nombre="Ajeno", total=100)
        response = self.client.get("/api/presupuestos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
