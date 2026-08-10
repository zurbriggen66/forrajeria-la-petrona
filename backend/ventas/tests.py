"""
Flujos críticos del POS (Fase 2): venta completa de punta a punta, stock,
idempotencia de la cola offline, aislamiento multi-tenant y fidelización.
"""
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from caja.models import CuentaPago
from clientes.models import Cliente
from core.models import Comercio, UsuarioComercio
from kubobots.models import KubobotsCliente
from productos.models import Producto
from .models import Venta

User = get_user_model()


class VentaCompletaTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)

        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", precio_costo=Decimal("100"),
            precio_venta=Decimal("200"), stock=Decimal("50"),
        )
        self.queso = Producto.objects.create(
            comercio=self.comercio, nombre="Queso", precio_costo=Decimal("1000"),
            precio_venta=Decimal("2000"), stock=Decimal("10"),
            venta_por_peso=True, unidad_medida="kg",
        )
        self.efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")

    def _payload(self, **overrides):
        payload = {
            "sync_uuid": str(uuid.uuid4()),
            "items": [
                {"producto": str(self.gaseosa.id), "cantidad": "2"},
                {"producto": str(self.queso.id), "cantidad": "1.5"},
            ],
            "cuenta_pago": str(self.efectivo.id),
            "metodo_pago": "efectivo",
            "monto_efectivo": "3000",
            "efectivo_recibido": "3000",
        }
        payload.update(overrides)
        return payload

    def test_venta_completa_descuenta_stock_y_genera_ticket(self):
        response = self.client.post("/api/ventas/", self._payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["numero_ticket"], 1)
        self.assertEqual(Decimal(response.data["total"]), Decimal("400.00") + Decimal("3000.00"))

        self.gaseosa.refresh_from_db()
        self.queso.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("48.000"))
        self.assertEqual(self.queso.stock, Decimal("8.500"))

        venta = Venta.objects.get(id=response.data["id"])
        self.assertEqual(venta.items.count(), 2)
        item_queso = venta.items.get(producto=self.queso)
        self.assertEqual(item_queso.peso_kg, Decimal("1.500"))

    def test_numero_ticket_es_secuencial_por_comercio(self):
        r1 = self.client.post("/api/ventas/", self._payload(), format="json")
        r2 = self.client.post("/api/ventas/", self._payload(items=[
            {"producto": str(self.gaseosa.id), "cantidad": "1"},
        ]), format="json")
        self.assertEqual(r1.data["numero_ticket"], 1)
        self.assertEqual(r2.data["numero_ticket"], 2)

    def test_usa_precio_de_oferta_si_esta_activa(self):
        self.gaseosa.oferta_activa = True
        self.gaseosa.precio_oferta = Decimal("150")
        self.gaseosa.save()

        response = self.client.post("/api/ventas/", self._payload(items=[
            {"producto": str(self.gaseosa.id), "cantidad": "2"},
        ]), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data["total"]), Decimal("300.00"))

    def test_rechaza_venta_sin_stock_suficiente(self):
        response = self.client.post("/api/ventas/", self._payload(items=[
            {"producto": str(self.gaseosa.id), "cantidad": "999"},
        ]), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("50.000"), "no debe descontar nada si falla la venta")

    def test_calcula_vuelto(self):
        response = self.client.post("/api/ventas/", self._payload(
            items=[{"producto": str(self.gaseosa.id), "cantidad": "1"}],
            monto_efectivo="500", efectivo_recibido="500",
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(response.data["vuelto"]), Decimal("300.00"))

    def test_idempotencia_mismo_sync_uuid_no_duplica(self):
        payload = self._payload(items=[{"producto": str(self.gaseosa.id), "cantidad": "1"}])
        r1 = self.client.post("/api/ventas/", payload, format="json")
        r2 = self.client.post("/api/ventas/", payload, format="json")

        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.data["id"], r2.data["id"])
        self.assertEqual(Venta.objects.filter(comercio=self.comercio).count(), 1)

        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("49.000"), "el reintento no debe descontar stock de nuevo")

    def test_no_puede_vender_producto_de_otro_comercio(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        producto_ajeno = Producto.objects.create(
            comercio=otro_comercio, nombre="Ajeno", precio_venta=Decimal("100"), stock=Decimal("10"),
        )
        response = self.client.post("/api/ventas/", self._payload(items=[
            {"producto": str(producto_ajeno.id), "cantidad": "1"},
        ]), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        producto_ajeno.refresh_from_db()
        self.assertEqual(producto_ajeno.stock, Decimal("10.000"))

    def test_suma_puntos_kubobots_si_esta_habilitado(self):
        self.comercio.kubobots_clientes_enabled = True
        self.comercio.kubobots_fid_tasa = Decimal("0.10")
        self.comercio.save()
        cliente = Cliente.objects.create(comercio=self.comercio, nombre="Cliente fiel")

        response = self.client.post("/api/ventas/", self._payload(
            items=[{"producto": str(self.gaseosa.id), "cantidad": "1"}],
            cliente=str(cliente.id),
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        kb = KubobotsCliente.objects.get(comercio=self.comercio, cliente=cliente)
        self.assertEqual(kb.puntos, Decimal("20.00"))  # 200 * 0.10

    def test_no_suma_puntos_si_cliente_esta_excluido(self):
        self.comercio.kubobots_clientes_enabled = True
        self.comercio.kubobots_fid_tasa = Decimal("0.10")
        self.comercio.save()
        cliente = Cliente.objects.create(comercio=self.comercio, nombre="Sin fidelización", kubobots_fid_off=True)

        self.client.post("/api/ventas/", self._payload(
            items=[{"producto": str(self.gaseosa.id), "cantidad": "1"}],
            cliente=str(cliente.id),
        ), format="json")
        self.assertFalse(KubobotsCliente.objects.filter(comercio=self.comercio, cliente=cliente).exists())
