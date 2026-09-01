import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaSesion
from clientes.models import Cliente
from core.models import Comercio, UsuarioComercio
from productos.models import Producto

from .models import Presupuesto, Venta

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

    def test_filtra_por_cliente_y_estado_para_la_ficha_del_cliente(self):
        """La ficha del cliente sólo quiere ver SUS presupuestos aprobados
        (ver ClienteDetalleModal) — no los de otro cliente, ni los que
        todavía están pendientes de que diga que sí."""
        cliente = Cliente.objects.create(comercio=self.comercio, nombre="Juan Pérez")
        otro_cliente = Cliente.objects.create(comercio=self.comercio, nombre="Otro Cliente")

        aprobado = self.client.post(
            "/api/presupuestos/", self._payload(cliente=str(cliente.id)), format="json"
        ).data
        self.client.post(f"/api/presupuestos/{aprobado['id']}/estado/", {"estado": "aprobado"}, format="json")

        # Pendiente del mismo cliente: no debe aparecer en el filtro.
        self.client.post("/api/presupuestos/", self._payload(cliente=str(cliente.id)), format="json")
        # Aprobado de otro cliente: tampoco.
        otro_aprobado = self.client.post(
            "/api/presupuestos/", self._payload(cliente=str(otro_cliente.id)), format="json"
        ).data
        self.client.post(f"/api/presupuestos/{otro_aprobado['id']}/estado/", {"estado": "aprobado"}, format="json")

        response = self.client.get(f"/api/presupuestos/?cliente={cliente.id}&estado=aprobado")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        ids = [p["id"] for p in response.data["results"]]
        self.assertEqual(ids, [aprobado["id"]])

    def test_editar_reemplaza_los_items_y_recalcula(self):
        creado = self.client.post("/api/presupuestos/", self._payload(), format="json")
        presupuesto_id = creado.data["id"]
        response = self.client.put(f"/api/presupuestos/{presupuesto_id}/", self._payload(
            items=[{"producto": str(self.balanceado.id), "cantidad": "1", "es_bolsa": True}],
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("10000.00"))
        self.assertEqual(Presupuesto.objects.get(id=presupuesto_id).items.count(), 1)

    def test_cobrar_linkea_la_venta_resultante(self):
        """El frontend crea la Venta por la vía normal (POST /ventas/) y sólo
        manda el id acá para linkearla — así las estadísticas, que sólo miran
        Venta, ven esta plata con su método de pago real."""
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta")
        creado = self.client.post("/api/presupuestos/", self._payload(), format="json").data
        self.client.post(f"/api/presupuestos/{creado['id']}/estado/", {"estado": "aprobado"}, format="json")

        venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.balanceado.id), "cantidad": "2", "es_bolsa": True}],
            "metodo_pago": "efectivo", "monto_efectivo": "20000", "efectivo_recibido": "20000",
        }, format="json").data

        response = self.client.post(f"/api/presupuestos/{creado['id']}/estado/", {
            "estado": "cobrado", "venta": venta["id"],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["estado"], "cobrado")
        self.assertEqual(str(response.data["venta"]), venta["id"])
        self.assertEqual(response.data["venta_numero_ticket"], venta["numero_ticket"])

        presupuesto = Presupuesto.objects.get(id=creado["id"])
        self.assertEqual(str(presupuesto.venta_id), venta["id"])

    def test_rechaza_linkear_venta_de_otro_comercio(self):
        otro = Comercio.objects.create(nombre="Otro comercio")
        venta_ajena = Venta.objects.create(comercio=otro, total=100)
        creado = self.client.post("/api/presupuestos/", self._payload(), format="json").data

        response = self.client.post(f"/api/presupuestos/{creado['id']}/estado/", {
            "estado": "cobrado", "venta": str(venta_ajena.id),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_ve_presupuestos_de_otro_comercio(self):
        otro = Comercio.objects.create(nombre="Otro comercio")
        Presupuesto.objects.create(comercio=otro, cliente_nombre="Ajeno", total=100)
        response = self.client.get("/api/presupuestos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)


class PresupuestoYStockTests(APITestCase):
    """Cuándo mueve stock un presupuesto y cómo queda marcada la venta.

    Un presupuesto es una cotización: no toca nada hasta que se factura. La
    venta que sale de ahí es una venta real —descuenta stock, entra a caja— y
    tiene que poder distinguirse en el historial de una del mostrador.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        self.user = User.objects.create_user(username="dueno-presu", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta", monto_apertura=Decimal("0"))

        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Maíz partido", precio_venta=Decimal("1500.00"),
            precio_costo=Decimal("900.0000"), stock=Decimal("100"),
        )

    def _stock(self):
        self.producto.refresh_from_db()
        return self.producto.stock

    def _presupuestar(self, cantidad="4"):
        return self.client.post("/api/presupuestos/", {
            "cliente_nombre": "Juan Pérez", "descuento": "0",
            "items": [{"producto": str(self.producto.id), "cantidad": cantidad}],
        }, format="json")

    def test_presupuestar_no_mueve_stock(self):
        response = self._presupuestar()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["estado"], "pendiente")
        self.assertEqual(self._stock(), Decimal("100.000"))

    def test_aprobar_tampoco_mueve_stock_por_si_solo(self):
        """Aprobar es sólo el estado: la mercadería sale cuando se factura.
        Por eso el frontend abre el cobro apenas se aprueba — si no, quedaba
        aprobado para siempre sin venta ni descuento de stock."""
        presupuesto_id = self._presupuestar().data["id"]
        response = self.client.post(f"/api/presupuestos/{presupuesto_id}/estado/",
                                    {"estado": "aprobado"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["estado"], "aprobado")
        self.assertIsNone(response.data["venta"])
        self.assertEqual(self._stock(), Decimal("100.000"))

    def test_facturarlo_descuenta_stock_y_marca_el_origen(self):
        presupuesto_id = self._presupuestar().data["id"]

        venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "metodo_pago": "efectivo",
            "origen": "presupuesto",
            "items": [{"producto": str(self.producto.id), "cantidad": "4"}],
        }, format="json")
        self.assertEqual(venta.status_code, status.HTTP_201_CREATED, venta.data)
        # Distinta de una del mostrador: es lo que el historial usa para el badge.
        self.assertEqual(venta.data["origen"], "presupuesto")
        self.assertEqual(self._stock(), Decimal("96.000"))

        response = self.client.post(f"/api/presupuestos/{presupuesto_id}/estado/",
                                    {"estado": "cobrado", "venta": venta.data["id"]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["estado"], "cobrado")
        self.assertEqual(str(response.data["venta"]), str(venta.data["id"]))

    def test_una_venta_del_mostrador_no_lleva_origen_de_presupuesto(self):
        venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()), "metodo_pago": "efectivo",
            "items": [{"producto": str(self.producto.id), "cantidad": "1"}],
        }, format="json")
        self.assertEqual(venta.data["origen"], "pos")

    def test_anular_la_venta_devuelve_el_stock_del_presupuesto(self):
        venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()), "metodo_pago": "efectivo", "origen": "presupuesto",
            "items": [{"producto": str(self.producto.id), "cantidad": "4"}],
        }, format="json")
        self.assertEqual(self._stock(), Decimal("96.000"))
        self.client.post(f"/api/ventas/{venta.data['id']}/anular/", {"motivo": "prueba"}, format="json")
        self.assertEqual(self._stock(), Decimal("100.000"))
