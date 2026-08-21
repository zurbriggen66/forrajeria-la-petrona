"""
Cuenta corriente de clientes, asignaciones a vendedor y leads CRM (Fase 6).
Kubobots queda deliberadamente fuera de esta fase.
"""
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Comercio, Perfil, UsuarioComercio

from .models import Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead
from .views import aplicar_movimiento_cliente

User = get_user_model()


class ClienteCuentaCorrienteTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)", telefono="1155550000")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Juan Pérez", celular="1155551234", limite_credito=Decimal("5000")
        )

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

    @patch("clientes.views.enviar_whatsapp")
    def test_cargo_avisa_por_whatsapp_al_cliente_y_al_comercio(self, mock_enviar):
        # "cargo" sólo lo genera una venta fiada (ver ventas/views.py), no el
        # alta manual — se prueba la función compartida directamente.
        aplicar_movimiento_cliente(self.cliente, "cargo", Decimal("300"), "Alimento balanceado")
        self.assertEqual(mock_enviar.call_count, 2)
        destinatarios = {llamada.args[0] for llamada in mock_enviar.call_args_list}
        self.assertEqual(destinatarios, {"1155551234", "1155550000"})

    @patch("clientes.views.enviar_whatsapp")
    def test_pago_avisa_solo_al_cliente_por_whatsapp(self, mock_enviar):
        # A diferencia del cargo, el pago no le avisa al comercio (dueño) —
        # es un recibo para quien pagó, no un aviso administrativo.
        self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "pago", "monto": "100", "medio_pago": "transferencia"}, format="json",
        )
        mock_enviar.assert_called_once()
        destinatario, mensaje = mock_enviar.call_args.args
        self.assertEqual(destinatario, "1155551234")
        self.assertIn("Transferencia", mensaje)

    @patch("clientes.views.enviar_whatsapp")
    def test_pago_sin_celular_no_avisa(self, mock_enviar):
        self.cliente.celular = ""
        self.cliente.save()
        self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/", {"tipo": "pago", "monto": "100"}, format="json",
        )
        mock_enviar.assert_not_called()

    def test_editar_ajuste_recalcula_el_saldo(self):
        response = self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "ajuste", "monto": "100", "referencia": "Error de tipeo"}, format="json",
        )
        movimiento_id = response.data["id"]

        response = self.client.patch(
            f"/api/clientes/{self.cliente.id}/movimientos/{movimiento_id}/",
            {"monto": "10", "referencia": "Corregido"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("10.00"))
        self.assertEqual(ClienteMovimiento.objects.get(pk=movimiento_id).referencia, "Corregido")

    def test_borrar_pago_revierte_el_saldo(self):
        self.cliente.saldo_actual = Decimal("1000")
        self.cliente.save()
        response = self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/", {"tipo": "pago", "monto": "400"}, format="json",
        )
        movimiento_id = response.data["id"]
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("600.00"))

        response = self.client.delete(f"/api/clientes/{self.cliente.id}/movimientos/{movimiento_id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("1000.00"))
        self.assertFalse(ClienteMovimiento.objects.filter(pk=movimiento_id).exists())

    def test_no_se_puede_editar_ni_borrar_un_cargo(self):
        movimiento = ClienteMovimiento.objects.create(
            comercio=self.comercio, cliente=self.cliente, tipo="cargo", monto=Decimal("300"), referencia="Venta #1",
        )

        response = self.client.patch(
            f"/api/clientes/{self.cliente.id}/movimientos/{movimiento.id}/", {"monto": "10"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.delete(f"/api/clientes/{self.cliente.id}/movimientos/{movimiento.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

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
