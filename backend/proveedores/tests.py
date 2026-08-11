"""
Cuenta corriente de proveedores y pedidos sugeridos (Fase 5).
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Comercio, UsuarioComercio
from productos.models import Producto

from .models import Proveedor, ProveedorMovimiento

User = get_user_model()


class ProveedorCuentaCorrienteTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Distribuidora Sur")

    def test_pago_manual_reduce_el_saldo(self):
        self.proveedor.saldo_actual = Decimal("1000")
        self.proveedor.save()

        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/movimientos/nuevo/",
            {"tipo": "pago", "monto": "400", "referencia": "Transferencia"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.saldo_actual, Decimal("600.00"))

    def test_ajuste_manual_puede_sumar_o_restar(self):
        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/movimientos/nuevo/",
            {"tipo": "ajuste", "monto": "-150", "referencia": "Nota de crédito"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.saldo_actual, Decimal("-150.00"))

    def test_pago_no_puede_ser_cero_o_negativo(self):
        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/movimientos/nuevo/",
            {"tipo": "pago", "monto": "0"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lista_movimientos_del_proveedor(self):
        self.client.post(
            f"/api/proveedores/{self.proveedor.id}/movimientos/nuevo/",
            {"tipo": "ajuste", "monto": "50"}, format="json",
        )
        response = self.client.get(f"/api/proveedores/{self.proveedor.id}/movimientos/")
        self.assertEqual(len(response.data), 1)

    def test_no_puede_operar_sobre_proveedor_de_otro_comercio(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        ajeno = Proveedor.objects.create(comercio=otro_comercio, nombre="Ajeno")
        response = self.client.post(
            f"/api/proveedores/{ajeno.id}/movimientos/nuevo/", {"tipo": "pago", "monto": "10"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(ProveedorMovimiento.objects.filter(proveedor=ajeno).exists())


class PedidosSugeridosTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.proveedor = Proveedor.objects.create(comercio=self.comercio, nombre="Distribuidora Sur")

    def test_sugiere_solo_productos_bajo_el_minimo(self):
        Producto.objects.create(
            comercio=self.comercio, nombre="Bajo", proveedor=self.proveedor,
            stock=Decimal("2"), stock_minimo=Decimal("10"),
        )
        Producto.objects.create(
            comercio=self.comercio, nombre="OK", proveedor=self.proveedor,
            stock=Decimal("50"), stock_minimo=Decimal("10"),
        )
        Producto.objects.create(
            comercio=self.comercio, nombre="Sin mínimo configurado",
            stock=Decimal("0"), stock_minimo=Decimal("0"),
        )

        response = self.client.get("/api/pedidos/sugeridos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        nombres = [f["nombre"] for f in response.data]
        self.assertEqual(nombres, ["Bajo"])
        self.assertEqual(Decimal(response.data[0]["cantidad_sugerida"]), Decimal("8.000"))
        self.assertEqual(response.data[0]["proveedor_nombre"], "Distribuidora Sur")
