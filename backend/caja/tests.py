"""
Flujos críticos de caja (Fase 3): apertura/cierre, arqueo con diferencias, y
que no se pueda vender ni registrar movimientos con la caja cerrada.
"""
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Comercio, UsuarioComercio
from productos.models import Producto

from .models import CajaMovimiento, CajaSesion, CuentaPago

User = get_user_model()


class CajaAperturaCierreTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)

    def test_abrir_caja_registra_saldo_inicial(self):
        response = self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["estado"], "abierta")
        self.assertEqual(Decimal(response.data["monto_apertura"]), Decimal("1000.00"))

    def test_no_se_puede_abrir_una_segunda_caja(self):
        self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")
        response = self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "500"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CajaSesion.objects.filter(comercio=self.comercio, estado="abierta").count(), 1)

    def test_endpoint_actual_devuelve_la_sesion_abierta(self):
        # Sin sesión abierta el endpoint devuelve el literal JSON `null`, no un
        # Response de DRF (ver caja/views.py) — por eso acá se usa .json() y
        # no .data.
        self.assertIsNone(self.client.get("/api/caja/sesiones/actual/").json())
        apertura = self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")
        response = self.client.get("/api/caja/sesiones/actual/")
        self.assertEqual(response.data["id"], apertura.data["id"])

    def test_no_se_puede_vender_con_la_caja_cerrada(self):
        producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", precio_venta=Decimal("500"), stock=Decimal("10"),
        )
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(producto.id), "cantidad": "1"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        producto.refresh_from_db()
        self.assertEqual(producto.stock, Decimal("10.000"), "no debe descontar stock si la venta fue rechazada")

    def test_no_se_puede_registrar_movimiento_manual_sin_caja_abierta(self):
        response = self.client.post("/api/caja/movimientos/", {
            "tipo": "ingreso", "concepto": "Préstamo", "monto": "500",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cerrar_caja_calcula_arqueo_sin_diferencia(self):
        apertura = self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")
        sesion_id = apertura.data["id"]

        producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", precio_venta=Decimal("500"), stock=Decimal("10"),
        )
        self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(producto.id), "cantidad": "2"}],
        }, format="json")  # ingreso de 1000

        self.client.post("/api/caja/movimientos/", {
            "tipo": "egreso", "concepto": "Pago proveedor", "monto": "300",
        }, format="json")

        self.client.post("/api/finanzas/gastos/", {
            "categoria": "Insumos", "descripcion": "Bolsas", "monto": "200", "fecha": "2026-08-10",
        }, format="json")

        # esperado = 1000 (apertura) + 1000 (venta) - 300 (egreso manual) - 200 (gasto) = 1500
        response = self.client.post(f"/api/caja/sesiones/{sesion_id}/cerrar/", {"monto_cierre": "1500"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["monto_esperado"]), Decimal("1500.00"))
        self.assertEqual(Decimal(response.data["diferencia"]), Decimal("0.00"))
        self.assertEqual(response.data["estado"], "cerrada")

    def test_cerrar_caja_reporta_diferencia_de_arqueo(self):
        apertura = self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")
        sesion_id = apertura.data["id"]

        response = self.client.post(f"/api/caja/sesiones/{sesion_id}/cerrar/", {"monto_cierre": "950"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data["monto_esperado"]), Decimal("1000.00"))
        self.assertEqual(Decimal(response.data["diferencia"]), Decimal("-50.00"))

    def test_no_se_puede_cerrar_una_caja_ya_cerrada(self):
        apertura = self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")
        sesion_id = apertura.data["id"]
        self.client.post(f"/api/caja/sesiones/{sesion_id}/cerrar/", {"monto_cierre": "1000"}, format="json")

        response = self.client.post(f"/api/caja/sesiones/{sesion_id}/cerrar/", {"monto_cierre": "1000"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_venta_genera_movimiento_de_caja_asociado_a_la_sesion(self):
        apertura = self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")
        sesion_id = apertura.data["id"]

        producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", precio_venta=Decimal("500"), stock=Decimal("10"),
        )
        self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(producto.id), "cantidad": "1"}],
        }, format="json")

        movimiento = CajaMovimiento.objects.get(sesion_id=sesion_id, tipo="ingreso")
        self.assertEqual(movimiento.monto, Decimal("500.00"))

    def test_aislamiento_multi_tenant_de_sesiones(self):
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        CajaSesion.objects.create(comercio=otro_comercio, estado="abierta", monto_apertura=Decimal("999"))

        response = self.client.get("/api/caja/sesiones/actual/")
        self.assertIsNone(response.json(), "no debe ver la caja abierta de otro comercio")


class ContenedoresYTransferenciasTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.banco = CuentaPago.objects.create(comercio=self.comercio, nombre="BANCO", tipo="banco")
        self.client.post("/api/caja/sesiones/abrir/", {"monto_apertura": "1000"}, format="json")

    def _contenedor(self, data, nombre):
        return next(c for c in data["contenedores"] if c["nombre"] == nombre)

    def test_apertura_se_asigna_al_contenedor_efectivo(self):
        actual = self.client.get("/api/caja/sesiones/actual/")
        efectivo = self._contenedor(actual.data, "Efectivo")
        banco = self._contenedor(actual.data, "BANCO")
        self.assertEqual(Decimal(efectivo["saldo_turno"]), Decimal("1000.00"))
        self.assertEqual(Decimal(banco["saldo_turno"]), Decimal("0.00"))
        self.assertEqual(Decimal(actual.data["ventas_efectivo"]), Decimal("0.00"))

    def test_venta_con_cuenta_pago_impacta_su_contenedor_no_el_de_efectivo(self):
        producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", precio_venta=Decimal("500"), stock=Decimal("10"),
        )
        self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(producto.id), "cantidad": "1"}],
            "cuenta_pago": str(self.banco.id),
        }, format="json")

        actual = self.client.get("/api/caja/sesiones/actual/")
        banco = self._contenedor(actual.data, "BANCO")
        efectivo = self._contenedor(actual.data, "Efectivo")
        self.assertEqual(Decimal(banco["saldo_turno"]), Decimal("500.00"))
        self.assertEqual(Decimal(efectivo["saldo_turno"]), Decimal("1000.00"), "la venta por banco no debe tocar el efectivo")
        self.assertEqual(Decimal(actual.data["ventas_efectivo"]), Decimal("0.00"))

    def test_transferencia_mueve_saldo_sin_afectar_el_arqueo_total(self):
        sesion_id = self.client.get("/api/caja/sesiones/actual/").data["id"]

        response = self.client.post("/api/caja/movimientos/transferir/", {
            "cuenta_origen": str(self.banco.id),
            "cuenta_destino": str(self.banco.id),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, "no debe permitir transferir a la misma cuenta")

        efectivo_id = self._contenedor(self.client.get("/api/caja/sesiones/actual/").data, "Efectivo")["cuenta"]
        response = self.client.post("/api/caja/movimientos/transferir/", {
            "cuenta_origen": efectivo_id, "cuenta_destino": str(self.banco.id), "monto": "300",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        actual = self.client.get("/api/caja/sesiones/actual/")
        self.assertEqual(Decimal(self._contenedor(actual.data, "Efectivo")["saldo_turno"]), Decimal("700.00"))
        self.assertEqual(Decimal(self._contenedor(actual.data, "BANCO")["saldo_turno"]), Decimal("300.00"))

        # Se cuenta cada contenedor por separado: en el cajón quedan 700 (los
        # 300 se fueron al banco), y el banco se acepta como está.
        cierre = self.client.post(f"/api/caja/sesiones/{sesion_id}/cerrar/", {
            "conteos": [{"cuenta": efectivo_id, "contado": "700"}],
        }, format="json")
        self.assertEqual(Decimal(cierre.data["monto_esperado"]), Decimal("1000.00"), "la transferencia no debe alterar el total esperado")
        self.assertEqual(Decimal(cierre.data["diferencia"]), Decimal("0.00"))

    def test_movimiento_manual_sin_cuenta_usa_efectivo_por_defecto(self):
        response = self.client.post("/api/caja/movimientos/", {
            "tipo": "egreso", "concepto": "Retiro", "monto": "100",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["cuenta_nombre"], "Efectivo")

        actual = self.client.get("/api/caja/sesiones/actual/")
        self.assertEqual(Decimal(actual.data["retiros"]), Decimal("100.00"))


class ArqueoPorContenedorTests(APITestCase):
    """El arqueo se hace contenedor por contenedor.

    Con un único total, la plata cobrada por transferencia se sumaba al
    efectivo esperado: un turno normal cerraba con un faltante gigante y un
    faltante real de billetes quedaba escondido adentro de ese número.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        self.banco = CuentaPago.objects.create(comercio=self.comercio, nombre="Transferencia", tipo="transferencia")
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", precio_costo=Decimal("1"),
            precio_venta=Decimal("1000"), stock=Decimal("1000"),
        )
        self.sesion_id = self.client.post(
            "/api/caja/sesiones/abrir/", {"monto_apertura": "5000"}, format="json",
        ).data["id"]

    def _vender(self, cuenta, cantidad):
        return self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.producto.id), "cantidad": str(cantidad)}],
            "cuenta_pago": str(cuenta.id),
        }, format="json")

    def _cerrar(self, **contados):
        return self.client.post(f"/api/caja/sesiones/{self.sesion_id}/cerrar/", {
            "conteos": [
                {"cuenta": str(getattr(self, nombre).id), "contado": monto}
                for nombre, monto in contados.items()
            ],
        }, format="json")

    def _conteo(self, data, nombre):
        return next(c for c in data["conteos"] if c["cuenta_nombre"] == nombre)

    def test_cobrar_por_transferencia_no_genera_un_faltante_de_efectivo(self):
        """El caso que rompía todos los días: $10.000 en efectivo y $50.000 por
        transferencia. En el cajón hay 15.000 y el arqueo tiene que dar cero."""
        self._vender(self.efectivo, 10)
        self._vender(self.banco, 50)

        response = self._cerrar(efectivo="15000")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["diferencia"]), Decimal("0.00"))
        self.assertEqual(Decimal(self._conteo(response.data, "Efectivo")["diferencia"]), Decimal("0.00"))

    def test_un_faltante_de_efectivo_se_atribuye_a_su_contenedor(self):
        self._vender(self.efectivo, 10)
        self._vender(self.banco, 50)

        response = self._cerrar(efectivo="13000")
        self.assertEqual(Decimal(response.data["diferencia"]), Decimal("-2000.00"))

        efectivo = self._conteo(response.data, "Efectivo")
        self.assertEqual(Decimal(efectivo["esperado"]), Decimal("15000.00"))
        self.assertEqual(Decimal(efectivo["contado"]), Decimal("13000.00"))
        self.assertEqual(Decimal(efectivo["diferencia"]), Decimal("-2000.00"))
        # El banco no se contó: se da por bueno, no inventa un faltante.
        self.assertEqual(Decimal(self._conteo(response.data, "Transferencia")["diferencia"]), Decimal("0.00"))

    def test_un_contenedor_no_contado_se_da_por_bueno(self):
        self._vender(self.banco, 50)
        response = self._cerrar(efectivo="5000")

        banco = self._conteo(response.data, "Transferencia")
        self.assertEqual(Decimal(banco["esperado"]), Decimal("50000.00"))
        self.assertEqual(Decimal(banco["contado"]), Decimal("50000.00"))
        self.assertEqual(Decimal(response.data["diferencia"]), Decimal("0.00"))

    def test_rechaza_contar_un_contenedor_de_otro_comercio(self):
        ajena = CuentaPago.objects.create(
            comercio=Comercio.objects.create(nombre="Otro"), nombre="Ajena", tipo="efectivo",
        )
        response = self.client.post(f"/api/caja/sesiones/{self.sesion_id}/cerrar/", {
            "conteos": [{"cuenta": str(ajena.id), "contado": "100"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            CajaSesion.objects.get(pk=self.sesion_id).estado, "abierta",
            "un cierre rechazado no puede dejar la caja cerrada",
        )

    def test_exige_el_recuento(self):
        response = self.client.post(f"/api/caja/sesiones/{self.sesion_id}/cerrar/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_una_cuenta_desactivada_a_mitad_de_turno_sigue_entrando_al_arqueo(self):
        """Su plata existe igual: si se cayera del arqueo, el turno cerraría
        con un faltante por dinero que en realidad está."""
        self._vender(self.banco, 50)
        self.banco.activo = False
        self.banco.save(update_fields=["activo"])

        response = self._cerrar(efectivo="5000")
        self.assertEqual(Decimal(self._conteo(response.data, "Transferencia")["esperado"]), Decimal("50000.00"))
        self.assertEqual(Decimal(response.data["diferencia"]), Decimal("0.00"))
