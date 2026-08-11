"""
Cuenta corriente de clientes, asignaciones a vendedor y leads CRM (Fase 6).
Kubobots queda deliberadamente fuera de esta fase.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Comercio, Perfil, UsuarioComercio

from .models import Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead

User = get_user_model()


class ClienteCuentaCorrienteTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.cliente = Cliente.objects.create(comercio=self.comercio, nombre="Juan Pérez", limite_credito=Decimal("5000"))

    def test_pago_manual_reduce_el_saldo(self):
        self.cliente.saldo_actual = Decimal("1000")
        self.cliente.save()

        response = self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "pago", "monto": "400", "referencia": "Efectivo"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("600.00"))

    def test_ajuste_manual_puede_sumar_o_restar(self):
        response = self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "ajuste", "monto": "-150"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("-150.00"))

    def test_pago_no_puede_ser_cero_o_negativo(self):
        response = self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/", {"tipo": "pago", "monto": "0"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lista_movimientos_del_cliente(self):
        self.client.post(f"/api/clientes/{self.cliente.id}/movimientos/nuevo/", {"tipo": "ajuste", "monto": "50"}, format="json")
        response = self.client.get(f"/api/clientes/{self.cliente.id}/movimientos/")
        self.assertEqual(len(response.data), 1)

    def test_no_puede_operar_sobre_cliente_de_otro_comercio(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        ajeno = Cliente.objects.create(comercio=otro_comercio, nombre="Ajeno")
        response = self.client.post(
            f"/api/clientes/{ajeno.id}/movimientos/nuevo/", {"tipo": "pago", "monto": "10"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(ClienteMovimiento.objects.filter(cliente=ajeno).exists())

    def test_aislamiento_multi_tenant_de_clientes(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        Cliente.objects.create(comercio=otro_comercio, nombre="Ajeno")
        response = self.client.get("/api/clientes/")
        nombres = [c["nombre"] for c in response.data["results"]]
        self.assertEqual(nombres, ["Juan Pérez"])


class ClienteAsignacionTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.cliente = Cliente.objects.create(comercio=self.comercio, nombre="Juan Pérez")
        self.vendedor_user = User.objects.create_user(username="vendedora", password="testpass123")
        self.vendedor = Perfil.objects.filter(user=self.vendedor_user).first() or Perfil.objects.create(
            user=self.vendedor_user, comercio=self.comercio, nombre_completo="María Vendedora",
        )

    def test_asignar_vendedor_a_cliente(self):
        response = self.client.post("/api/clientes-asignaciones/", {
            "cliente": str(self.cliente.id), "vendedor": str(self.vendedor.id), "activo": True,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["vendedor_nombre"], "María Vendedora")
        self.assertTrue(ClienteAsignacion.objects.filter(cliente=self.cliente, vendedor=self.vendedor).exists())

    def test_filtra_asignaciones_por_cliente(self):
        ClienteAsignacion.objects.create(comercio=self.comercio, cliente=self.cliente, vendedor=self.vendedor)
        otro_cliente = Cliente.objects.create(comercio=self.comercio, nombre="Otro cliente")
        ClienteAsignacion.objects.create(comercio=self.comercio, cliente=otro_cliente, vendedor=self.vendedor)

        response = self.client.get(f"/api/clientes-asignaciones/?cliente={self.cliente.id}")
        self.assertEqual(response.data["count"], 1)


class CrmLeadTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def test_crear_y_listar_lead(self):
        response = self.client.post("/api/crm/leads/", {
            "nombre": "Posible cliente", "telefono": "1122334455", "estado": "nuevo",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        listado = self.client.get("/api/crm/leads/")
        self.assertEqual(listado.data["count"], 1)

    def test_filtra_leads_por_estado(self):
        CrmLead.objects.create(comercio=self.comercio, nombre="A", estado="nuevo")
        CrmLead.objects.create(comercio=self.comercio, nombre="B", estado="ganado")

        response = self.client.get("/api/crm/leads/?estado=ganado")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["nombre"], "B")

    def test_aislamiento_multi_tenant_de_leads(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        CrmLead.objects.create(comercio=otro_comercio, nombre="Ajeno")
        response = self.client.get("/api/crm/leads/")
        self.assertEqual(response.data["count"], 0)
