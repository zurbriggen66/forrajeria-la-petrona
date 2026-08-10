from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaMovimiento, CajaSesion
from core.models import Comercio, UsuarioComercio

from .models import Gasto

User = get_user_model()


class GastoTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)

    def _payload(self, **overrides):
        payload = {"categoria": "Insumos", "descripcion": "Bolsas", "monto": "200", "fecha": "2026-08-10"}
        payload.update(overrides)
        return payload

    def test_registrar_gasto_con_caja_abierta_genera_egreso_en_la_sesion(self):
        sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta", monto_apertura=Decimal("1000"))

        response = self.client.post("/api/finanzas/gastos/", self._payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(str(response.data["caja_sesion"]), str(sesion.id))

        movimiento = CajaMovimiento.objects.get(sesion=sesion, tipo="egreso")
        self.assertEqual(movimiento.monto, Decimal("200.00"))

    def test_registrar_gasto_sin_caja_abierta_no_genera_movimiento(self):
        response = self.client.post("/api/finanzas/gastos/", self._payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["caja_sesion"])
        self.assertFalse(CajaMovimiento.objects.exists())

    def test_registrar_gasto_con_cuenta_especifica_impacta_ese_contenedor(self):
        from caja.models import CuentaPago

        banco = CuentaPago.objects.create(comercio=self.comercio, nombre="BANCO", tipo="banco")
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta", monto_apertura=Decimal("0"))

        response = self.client.post(
            "/api/finanzas/gastos/", self._payload(cuenta_id=str(banco.id)), format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["cuenta_nombre"], "BANCO")

        movimiento = CajaMovimiento.objects.get(tipo="egreso")
        self.assertEqual(movimiento.cuenta, banco)

    def test_gasto_no_pertenece_a_otro_comercio(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        Gasto.objects.create(comercio=otro_comercio, categoria="Ajeno", monto=Decimal("50"), fecha="2026-08-10")

        response = self.client.get("/api/finanzas/gastos/")
        self.assertEqual(response.data["count"], 0)
