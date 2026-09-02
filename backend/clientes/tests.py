"""
Cuenta corriente de clientes, asignaciones a vendedor y leads CRM (Fase 6).
Kubobots queda deliberadamente fuera de esta fase.
"""
import json
import tempfile
import uuid
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaMovimiento, CajaSesion, CuentaPago
from ventas.models import Venta
from core.models import Comercio, Perfil, UsuarioComercio

from django.utils import timezone
from datetime import timedelta

from .models import (
    Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead, MovimientoAuditoria,
)
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
            {"monto": "10", "referencia": "Corregido", "motivo": "Se habia tipeado mal"}, format="json",
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

        response = self.client.delete(
            f"/api/clientes/{self.cliente.id}/movimientos/{movimiento_id}/",
            {"motivo": "El pago era de otro cliente"}, format="json",
        )
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

    def test_se_puede_ordenar_alfabeticamente(self):
        Cliente.objects.create(comercio=self.comercio, nombre="Ana Gómez")
        Cliente.objects.create(comercio=self.comercio, nombre="Zoe Ruiz")

        response = self.client.get("/api/clientes/", {"ordering": "nombre"})
        self.assertEqual([c["nombre"] for c in response.data["results"]], ["Ana Gómez", "Juan Pérez", "Zoe Ruiz"])

        response = self.client.get("/api/clientes/", {"ordering": "-nombre"})
        self.assertEqual([c["nombre"] for c in response.data["results"]], ["Zoe Ruiz", "Juan Pérez", "Ana Gómez"])

    def test_eliminar_cliente(self):
        response = self.client.delete(f"/api/clientes/{self.cliente.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Cliente.objects.filter(pk=self.cliente.id).exists())

    def test_eliminar_cliente_no_borra_sus_ventas(self):
        # La venta queda en el historial con cliente=None (SET_NULL en
        # ventas/models.py), no desaparece junto con el cliente.
        from ventas.models import Venta

        venta = Venta.objects.create(comercio=self.comercio, cliente=self.cliente, total=Decimal("100"))

        response = self.client.delete(f"/api/clientes/{self.cliente.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        venta.refresh_from_db()
        self.assertIsNone(venta.cliente)


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


class AuditoriaCuentaCorrienteTests(APITestCase):
    """Motivo obligatorio y rastro al tocar la cuenta corriente de un cliente.

    Antes un pago se podía corregir o borrar sin motivo y sin dejar huella: el
    saldo cambiaba y no quedaba forma de saber quién lo tocó, cuánto era antes
    ni por qué.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno-audit", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Gastón", rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Doña Rosa", saldo_actual=Decimal("1000"),
        )

    def _pago(self, monto="400"):
        return self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "pago", "monto": monto, "referencia": "Pago en mano"}, format="json",
        ).data["id"]

    def _url(self, movimiento_id):
        return f"/api/clientes/{self.cliente.id}/movimientos/{movimiento_id}/"

    def test_sin_motivo_no_se_puede_editar(self):
        mid = self._pago()
        response = self.client.patch(self._url(mid), {"monto": "500"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("motivo", response.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("600.00"))

    def test_sin_motivo_no_se_puede_borrar(self):
        mid = self._pago()
        response = self.client.delete(self._url(mid))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(ClienteMovimiento.objects.filter(pk=mid).exists())

    def test_un_motivo_en_blanco_tampoco_sirve(self):
        mid = self._pago()
        response = self.client.patch(self._url(mid), {"monto": "500", "motivo": "   "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_editar_deja_el_rastro_con_el_antes_y_el_despues(self):
        mid = self._pago("400")
        response = self.client.patch(
            self._url(mid), {"monto": "250", "motivo": "Habían pagado 250, no 400"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        rastro = MovimientoAuditoria.objects.get()
        self.assertEqual(rastro.accion, "editado")
        self.assertEqual(rastro.motivo, "Habían pagado 250, no 400")
        self.assertEqual(rastro.cliente_nombre, "Doña Rosa")
        self.assertEqual(rastro.monto_anterior, Decimal("400.00"))
        self.assertEqual(rastro.monto_nuevo, Decimal("250.00"))
        self.assertEqual(rastro.saldo_anterior, Decimal("600.00"))
        self.assertEqual(rastro.saldo_nuevo, Decimal("750.00"))
        self.assertEqual(rastro.hecho_por.nombre_completo, "Gastón")

    def test_borrar_deja_el_rastro_del_movimiento_que_ya_no_existe(self):
        mid = self._pago("400")
        self.client.delete(self._url(mid), {"motivo": "Era de otro cliente"}, format="json")

        self.assertFalse(ClienteMovimiento.objects.filter(pk=mid).exists())
        rastro = MovimientoAuditoria.objects.get()
        self.assertEqual(rastro.accion, "eliminado")
        self.assertEqual(str(rastro.movimiento_id), str(mid))
        self.assertEqual(rastro.monto_anterior, Decimal("400.00"))
        self.assertIsNone(rastro.monto_nuevo)
        self.assertEqual(rastro.referencia_anterior, "Pago en mano")

    def test_el_rastro_sobrevive_al_borrado_del_cliente(self):
        """Por eso guarda copia del nombre y no depende de la ficha."""
        mid = self._pago()
        self.client.delete(self._url(mid), {"motivo": "prueba"}, format="json")
        self.cliente.delete()
        rastro = MovimientoAuditoria.objects.get()
        self.assertIsNone(rastro.cliente_id)
        self.assertEqual(rastro.cliente_nombre, "Doña Rosa")

    def test_el_endpoint_devuelve_la_ultima_semana(self):
        mid = self._pago()
        self.client.patch(self._url(mid), {"monto": "300", "motivo": "corrección"}, format="json")
        response = self.client.get("/api/clientes/auditoria/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        filas = response.data.get("results", response.data)
        self.assertEqual(len(filas), 1)
        self.assertEqual(filas[0]["motivo"], "corrección")

    def test_lo_viejo_sale_de_la_semana_pero_no_de_la_base(self):
        mid = self._pago()
        self.client.patch(self._url(mid), {"monto": "300", "motivo": "vieja"}, format="json")
        MovimientoAuditoria.objects.update(created_at=timezone.now() - timedelta(days=14))

        response = self.client.get("/api/clientes/auditoria/")
        self.assertEqual(len(response.data.get("results", response.data)), 0)
        # NO se borró: con el filtro de fechas se sigue viendo.
        self.assertEqual(MovimientoAuditoria.objects.count(), 1)
        desde = (timezone.now() - timedelta(days=30)).date().isoformat()
        response = self.client.get("/api/clientes/auditoria/", {"desde": desde})
        self.assertEqual(len(response.data.get("results", response.data)), 1)

    def test_un_cargo_de_venta_sigue_sin_poder_tocarse(self):
        movimiento = ClienteMovimiento.objects.create(
            comercio=self.comercio, cliente=self.cliente, tipo="cargo", monto=Decimal("500"),
        )
        response = self.client.patch(self._url(movimiento.pk), {"monto": "1", "motivo": "x"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MovimientoAuditoria.objects.count(), 0)


class ArchivarAuditoriaTests(APITestCase):
    """El comando que saca de la vista lo viejo sin perderlo."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.cliente = Cliente.objects.create(comercio=self.comercio, nombre="Doña Rosa")

    def _rastro(self, dias_atras):
        r = MovimientoAuditoria.objects.create(
            comercio=self.comercio, cliente=self.cliente, cliente_nombre="Doña Rosa",
            accion="eliminado", motivo="prueba", movimiento_id=uuid.uuid4(), tipo="pago",
            monto_anterior=Decimal("400"), saldo_anterior=Decimal("600"), saldo_nuevo=Decimal("1000"),
        )
        MovimientoAuditoria.objects.filter(pk=r.pk).update(
            created_at=timezone.now() - timedelta(days=dias_atras),
        )
        return r

    def test_sin_borrar_exporta_y_no_toca_la_base(self):
        """El default es no borrar: un registro de auditoría que se borra deja
        de ser un registro."""
        self._rastro(30)
        with tempfile.TemporaryDirectory() as carpeta:
            call_command("clientes_auditoria_archivar", destino=carpeta, verbosity=0)
            archivos = list(Path(carpeta).glob("*.json"))
            self.assertEqual(len(archivos), 1)
            datos = json.loads(archivos[0].read_text(encoding="utf-8"))
            self.assertEqual(len(datos), 1)
            self.assertEqual(datos[0]["motivo"], "prueba")
            self.assertEqual(datos[0]["cliente"], "Doña Rosa")
        self.assertEqual(MovimientoAuditoria.objects.count(), 1)

    def test_con_borrar_saca_de_la_base_lo_que_ya_exporto(self):
        self._rastro(30)
        with tempfile.TemporaryDirectory() as carpeta:
            call_command("clientes_auditoria_archivar", destino=carpeta, borrar=True, verbosity=0)
        self.assertEqual(MovimientoAuditoria.objects.count(), 0)

    def test_no_toca_lo_de_esta_semana(self):
        self._rastro(2)
        with tempfile.TemporaryDirectory() as carpeta:
            call_command("clientes_auditoria_archivar", destino=carpeta, borrar=True, verbosity=0)
            self.assertEqual(list(Path(carpeta).glob("*.json")), [])
        self.assertEqual(MovimientoAuditoria.objects.count(), 1)


class PagoDeCuentaCorrienteEnCajaTests(APITestCase):
    """La plata que un cliente trae para saldar la cuenta entra al cajón.

    Antes no entraba a ningún lado: el saldo del cliente bajaba y el arqueo del
    turno quedaba corto por ese monto, todos los días.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero-cc", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Gastón", rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.sesion = CajaSesion.objects.create(
            comercio=self.comercio, estado="abierta", monto_apertura=Decimal("0"),
        )
        self.efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        self.transferencia = CuentaPago.objects.create(
            comercio=self.comercio, nombre="Mercado Pago", tipo="transferencia",
        )
        self.cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Doña Rosa", saldo_actual=Decimal("60000"),
        )

    def _pagar(self, monto="40000", medio="efectivo"):
        return self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "pago", "monto": monto, "medio_pago": medio}, format="json",
        )

    def _ingresos(self, cuenta=None):
        qs = CajaMovimiento.objects.filter(sesion=self.sesion, tipo="ingreso")
        if cuenta:
            qs = qs.filter(cuenta=cuenta)
        return sum((m.monto for m in qs), Decimal("0"))

    def _saldo(self):
        self.cliente.refresh_from_db()
        return self.cliente.saldo_actual

    def test_un_pago_entra_a_la_caja_del_turno(self):
        response = self._pagar("40000")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(self._ingresos(), Decimal("40000.00"))
        self.assertEqual(self._saldo(), Decimal("20000.00"))
        movimiento = ClienteMovimiento.objects.get(pk=response.data["id"])
        self.assertEqual(movimiento.caja_sesion_id, self.sesion.id)
        self.assertEqual(movimiento.cuenta_pago_id, self.efectivo.id)

    def test_va_al_contenedor_del_medio_de_pago(self):
        """Un pago por transferencia no puede engordar el efectivo del cajón."""
        self._pagar("40000", "transferencia")
        self.assertEqual(self._ingresos(self.transferencia), Decimal("40000.00"))
        self.assertEqual(self._ingresos(self.efectivo), Decimal("0"))

    def test_paga_de_mas_y_queda_a_favor(self):
        """Debe 60.000, paga 100.000: el saldo queda en -40.000, que es plata a
        favor del cliente para su próxima compra."""
        self._pagar("100000")
        self.assertEqual(self._saldo(), Decimal("-40000.00"))
        # Y los 100.000 entraron enteros al cajón, no sólo los 60.000 que debía.
        self.assertEqual(self._ingresos(), Decimal("100000.00"))

    def test_el_cargo_de_una_venta_fiada_no_toca_la_caja(self):
        """Fiar no mueve plata física: si tocara el arqueo, la caja cerraría mal.

        Este endpoint ni siquiera acepta "cargo" —los cargos los genera la venta
        fiada— así que el cargo se crea como lo crea el POS."""
        rechazo = self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "cargo", "monto": "5000"}, format="json",
        )
        self.assertEqual(rechazo.status_code, status.HTTP_400_BAD_REQUEST)

        ClienteMovimiento.objects.create(
            comercio=self.comercio, cliente=self.cliente, tipo="cargo",
            monto=Decimal("5000"), referencia="Venta #1",
        )
        self.assertEqual(self._ingresos(), Decimal("0"))

    def test_un_ajuste_tampoco(self):
        self.client.post(
            f"/api/clientes/{self.cliente.id}/movimientos/nuevo/",
            {"tipo": "ajuste", "monto": "1000", "referencia": "corrección"}, format="json",
        )
        self.assertEqual(self._ingresos(), Decimal("0"))

    def test_borrar_un_pago_lo_saca_de_la_caja(self):
        mid = self._pagar("40000").data["id"]
        self.assertEqual(self._ingresos(), Decimal("40000.00"))
        self.client.delete(
            f"/api/clientes/{self.cliente.id}/movimientos/{mid}/",
            {"motivo": "era de otro cliente"}, format="json",
        )
        egresos = sum(
            (m.monto for m in CajaMovimiento.objects.filter(sesion=self.sesion, tipo="egreso")),
            Decimal("0"),
        )
        self.assertEqual(egresos, Decimal("40000.00"))
        self.assertEqual(self._saldo(), Decimal("60000.00"))

    def test_corregir_el_monto_corrige_la_caja(self):
        mid = self._pagar("40000").data["id"]
        self.client.patch(
            f"/api/clientes/{self.cliente.id}/movimientos/{mid}/",
            {"monto": "25000", "motivo": "había pagado 25.000"}, format="json",
        )
        # Entra 40.000, sale 40.000, entra 25.000: neto 25.000 en el turno.
        neto = sum(
            (m.monto if m.tipo == "ingreso" else -m.monto
             for m in CajaMovimiento.objects.filter(sesion=self.sesion)),
            Decimal("0"),
        )
        self.assertEqual(neto, Decimal("25000.00"))
        self.assertEqual(self._saldo(), Decimal("35000.00"))

    def test_sin_caja_abierta_el_pago_se_registra_igual_pero_fuera_del_arqueo(self):
        """Mismo criterio que un gasto o un pago a proveedor: no se traba el
        mostrador, pero queda visible que ese pago no está en ningún turno."""
        self.sesion.estado = "cerrada"
        self.sesion.save(update_fields=["estado"])
        response = self._pagar("40000")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(ClienteMovimiento.objects.get(pk=response.data["id"]).caja_sesion_id)
        self.assertEqual(self._saldo(), Decimal("20000.00"))
        self.assertEqual(CajaMovimiento.objects.count(), 0)


class EstadisticasDeClientesTests(APITestCase):
    """Los números de la cartera. Lo que el dueño mira para saber a quién
    llamar y a quién dejar de fiarle."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno-stats", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.fiel = Cliente.objects.create(
            comercio=self.comercio, nombre="Doña Rosa", saldo_actual=Decimal("5000"),
            limite_credito=Decimal("3000"),
        )
        self.dormido = Cliente.objects.create(comercio=self.comercio, nombre="Don Pedro")
        self.a_favor = Cliente.objects.create(
            comercio=self.comercio, nombre="Kiosco", saldo_actual=Decimal("-2000"),
        )

        def venta(cliente, total, dias_atras, anulada=False):
            v = Venta.objects.create(
                comercio=self.comercio, cliente=cliente, total=Decimal(total),
                numero_ticket=Venta.objects.count() + 1, anulada=anulada,
            )
            Venta.objects.filter(pk=v.pk).update(created_at=timezone.now() - timedelta(days=dias_atras))
            return v

        venta(self.fiel, "10000", 1)
        venta(self.fiel, "20000", 5)
        venta(self.dormido, "8000", 90)
        # Anulada: no puede contar como facturado.
        venta(self.fiel, "99999", 2, anulada=True)

    def _stats(self, **params):
        return self.client.get("/api/clientes/estadisticas/", params).data

    def test_resumen_de_la_cartera(self):
        d = self._stats()
        self.assertEqual(d["clientes"], 3)
        self.assertEqual(d["con_deuda"], 1)
        self.assertEqual(d["con_saldo_a_favor"], 1)
        self.assertEqual(Decimal(d["total_por_cobrar"]), Decimal("5000"))
        # A favor se devuelve en positivo: un negativo en la tarjeta se lee mal.
        self.assertEqual(Decimal(d["total_a_favor"]), Decimal("2000"))

    def test_las_anuladas_no_cuentan_como_facturado(self):
        d = self._stats()
        self.assertEqual(Decimal(d["facturado_a_clientes"]), Decimal("38000"))
        self.assertEqual(d["clientes_que_compraron"], 2)
        # 38.000 en 3 ventas válidas
        self.assertEqual(Decimal(d["ticket_promedio"]), Decimal("12666.67"))

    def test_top_compradores_ordenado_por_lo_que_gastaron(self):
        top = self._stats()["top_compradores"]
        self.assertEqual(top[0]["nombre"], "Doña Rosa")
        self.assertEqual(Decimal(top[0]["total"]), Decimal("30000"))
        self.assertEqual(top[0]["cantidad"], 2)
        self.assertEqual(Decimal(top[0]["ticket_promedio"]), Decimal("15000"))

    def test_los_dormidos_son_los_que_no_vuelven(self):
        """El número comercial que nadie mira: compraban y hace rato no vienen."""
        d = self._stats()
        nombres = [x["nombre"] for x in d["dormidos"]]
        self.assertEqual(nombres, ["Don Pedro"])
        self.assertEqual(d["dias_dormido"], 60)

    def test_la_ventana_de_dormido_se_puede_cambiar(self):
        self.assertEqual(self._stats(dias_dormido=120)["dormidos"], [])
        self.assertEqual(len(self._stats(dias_dormido=3)["dormidos"]), 1)

    def test_avisa_quien_paso_su_limite_de_credito(self):
        deudores = self._stats()["mayores_deudores"]
        self.assertEqual(deudores[0]["nombre"], "Doña Rosa")
        self.assertTrue(deudores[0]["paso_el_limite"])

    def test_no_ve_clientes_ni_ventas_de_otro_comercio(self):
        otro = Comercio.objects.create(nombre="Otro (test)")
        ajeno = Cliente.objects.create(comercio=otro, nombre="Ajeno", saldo_actual=Decimal("99999"))
        Venta.objects.create(comercio=otro, cliente=ajeno, total=Decimal("50000"), numero_ticket=1)
        d = self._stats()
        self.assertEqual(d["clientes"], 3)
        self.assertEqual(Decimal(d["total_por_cobrar"]), Decimal("5000"))
        self.assertNotIn("Ajeno", [x["nombre"] for x in d["top_compradores"]])
