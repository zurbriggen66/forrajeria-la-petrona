"""
Flujos críticos del POS (Fase 2): venta completa de punta a punta, stock,
idempotencia de la cola offline, aislamiento multi-tenant y fidelización.
"""
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from caja.models import CajaMovimiento, CajaSesion, CuentaPago
from clientes.models import Cliente
from core.models import Comercio, UsuarioComercio
from fiscal.afip import ErrorFiscal
from fiscal.models import ComercioFiscalConfig, FiscalQueue
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
        # Desde la Fase 3 toda venta requiere una caja abierta (ver caja/tests.py).
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

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

    def test_descuento_por_item_solo_afecta_a_ese_producto(self):
        """"Te hago 10% en la gaseosa": rebaja esa línea y ninguna otra.

        `precio_unitario` queda en el precio de lista (el remito muestra de
        cuánto fue la rebaja); lo que va neto es el subtotal."""
        response = self.client.post("/api/ventas/", self._payload(items=[
            {"producto": str(self.gaseosa.id), "cantidad": "2", "descuento_pct": "10"},
            {"producto": str(self.queso.id), "cantidad": "1.5"},
        ]), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        venta = Venta.objects.get(id=response.data["id"])
        item_gaseosa = venta.items.get(producto=self.gaseosa)
        self.assertEqual(item_gaseosa.precio_unitario, Decimal("200.00"))
        self.assertEqual(item_gaseosa.subtotal, Decimal("360.00"))
        # El queso no se tocó.
        self.assertEqual(venta.items.get(producto=self.queso).subtotal, Decimal("3000.00"))
        self.assertEqual(venta.total, Decimal("3360.00"))

    def test_rechaza_descuento_por_item_mayor_a_cien(self):
        """Sin tope, un 200% dejaría el precio negativo y la venta pagaría al
        cliente. El precio base lo pone el servidor; esto es lo único que el
        cliente puede mover."""
        response = self.client.post("/api/ventas/", self._payload(items=[
            {"producto": str(self.gaseosa.id), "cantidad": "2", "descuento_pct": "200"},
        ]), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_permite_vender_con_stock_insuficiente_por_defecto(self):
        """Comercio.permitir_venta_sin_stock nace en True: un stock mal
        cargado (todo en 0 tras una importación, por ejemplo) no puede frenar
        el mostrador. La venta entra y el stock queda en negativo, marcando
        que ese producto necesita un recuento."""
        response = self.client.post("/api/ventas/", self._payload(items=[
            {"producto": str(self.gaseosa.id), "cantidad": "999"},
        ]), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("50.000") - Decimal("999"))

    def test_rechaza_venta_sin_stock_suficiente_si_esta_desactivado(self):
        self.comercio.permitir_venta_sin_stock = False
        self.comercio.save(update_fields=["permitir_venta_sin_stock"])

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


class VentaAnulacionYFiltrosTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", categoria="Bebidas",
            precio_costo=Decimal("100"), precio_venta=Decimal("200"), stock=Decimal("50"),
        )

    def _vender(self, cantidad="2"):
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.gaseosa.id), "cantidad": cantidad}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def test_anular_repone_stock_y_no_borra_la_venta(self):
        venta = self._vender("3")
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("47.000"))

        response = self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Cliente se arrepintió"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["anulada"])
        self.assertEqual(response.data["motivo_anulacion"], "Cliente se arrepintió")

        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("50.000"), "debe reponer el stock vendido")
        self.assertTrue(Venta.objects.filter(id=venta["id"]).exists(), "la venta nunca se borra, sólo se anula")

    def test_anular_genera_egreso_compensatorio_si_la_caja_sigue_abierta(self):
        venta = self._vender("1")
        self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Error de carga"}, format="json")

        egreso = CajaMovimiento.objects.get(sesion=self.caja_sesion, tipo="egreso")
        self.assertEqual(egreso.monto, Decimal("200.00"))

    def test_anular_no_infla_los_kpi_de_ventas_efectivo_y_retiros_de_caja(self):
        venta = self._vender("1")
        self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Error de carga"}, format="json")

        actual = self.client.get("/api/caja/sesiones/actual/")
        self.assertEqual(
            Decimal(actual.data["retiros"]), Decimal("0.00"),
            "el egreso compensatorio de una anulación no es un retiro real de efectivo",
        )
        self.assertEqual(
            Decimal(actual.data["ventas_efectivo"]), Decimal("0.00"),
            "una venta anulada no cuenta como venta real del turno",
        )
        efectivo = next(c for c in actual.data["contenedores"] if c["nombre"] == "Efectivo")
        self.assertEqual(
            Decimal(efectivo["saldo_turno"]), self.caja_sesion.monto_apertura,
            "el saldo del contenedor sí tiene que netear ingreso y egreso para cerrar bien al arquear",
        )

    def test_anular_no_toca_una_sesion_de_caja_ya_cerrada(self):
        venta = self._vender("1")
        self.client.post(f"/api/caja/sesiones/{self.caja_sesion.id}/cerrar/", {"monto_cierre": "200"}, format="json")

        response = self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Post-cierre"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(CajaMovimiento.objects.filter(sesion=self.caja_sesion, tipo="egreso").exists())

    def test_no_se_puede_anular_dos_veces(self):
        venta = self._vender("1")
        self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Primera"}, format="json")
        response = self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Segunda"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anular_requiere_motivo(self):
        venta = self._vender("1")
        response = self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "  "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filtro_por_rango_de_fechas(self):
        self._vender("1")
        # timezone.now().date() da la fecha en UTC, no la fecha local del
        # comercio (Buenos Aires) — de noche difieren. localtime() la corrige.
        hoy_local = timezone.localtime(timezone.now()).date()
        hoy = hoy_local.isoformat()
        maniana = (hoy_local + timedelta(days=1)).isoformat()
        ayer = (hoy_local - timedelta(days=1)).isoformat()

        dentro = self.client.get(f"/api/ventas/?fecha_desde={hoy}&fecha_hasta={maniana}")
        fuera = self.client.get(f"/api/ventas/?fecha_desde={ayer}&fecha_hasta={ayer}")
        self.assertEqual(dentro.data["count"], 1)
        self.assertEqual(fuera.data["count"], 0)

    def test_filtro_por_categoria_de_producto(self):
        self._vender("1")
        con_categoria = self.client.get("/api/ventas/?categoria=Bebidas")
        sin_categoria = self.client.get("/api/ventas/?categoria=Lacteos")
        self.assertEqual(con_categoria.data["count"], 1)
        self.assertEqual(sin_categoria.data["count"], 0)

    def test_filtro_por_anulada(self):
        venta = self._vender("1")
        self._vender("1")
        self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "x"}, format="json")

        anuladas = self.client.get("/api/ventas/?anulada=true")
        activas = self.client.get("/api/ventas/?anulada=false")
        self.assertEqual(anuladas.data["count"], 1)
        self.assertEqual(activas.data["count"], 1)


class VentaCuentaCorrienteTests(APITestCase):
    """Fase 6: vender "fiado" tiene que sumar deuda al cliente, respetar su
    límite de crédito, y no contar como plata que entró a la caja."""

    def setUp(self):
        # Los cargos de venta fiada disparan WhatsApp (ver clientes/views.py):
        # se mockea acá para toda la clase, no test por test, así ningún test
        # nuevo de venta fiada termina pegándole a un bot real por olvido.
        self.mock_whatsapp = patch("clientes.views.enviar_whatsapp").start()
        self.addCleanup(patch.stopall)

        self.comercio = Comercio.objects.create(nombre="Comercio (test)", telefono="1155550000")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", precio_costo=Decimal("100"),
            precio_venta=Decimal("200"), stock=Decimal("50"),
        )
        self.cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Juan Fiado", celular="1155559999", limite_credito=Decimal("1000"),
        )

    def _vender_fiado(self, cantidad="1", monto_cuenta_corriente="200", cliente=None):
        return self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.gaseosa.id), "cantidad": cantidad}],
            "cliente": str((cliente or self.cliente).id),
            "monto_cuenta_corriente": monto_cuenta_corriente,
        }, format="json")

    def test_venta_fiada_suma_deuda_al_cliente_y_no_genera_ingreso_de_caja(self):
        response = self._vender_fiado()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("200.00"))
        self.assertFalse(CajaMovimiento.objects.filter(sesion=self.caja_sesion, tipo="ingreso").exists())

    def test_venta_fiada_avisa_por_whatsapp(self):
        response = self._vender_fiado()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(self.mock_whatsapp.call_count, 2)

    def test_venta_parcialmente_fiada_solo_ingresa_a_caja_lo_cobrado(self):
        # total 200: 120 en efectivo, 80 a cuenta corriente
        response = self._vender_fiado(monto_cuenta_corriente="80")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        ingreso = CajaMovimiento.objects.get(sesion=self.caja_sesion, tipo="ingreso")
        self.assertEqual(ingreso.monto, Decimal("120.00"))
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("80.00"))

    def test_no_se_puede_fiar_sin_elegir_cliente(self):
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.gaseosa.id), "cantidad": "1"}],
            "monto_cuenta_corriente": "200",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_permite_fiar_por_encima_del_limite_de_credito(self):
        """El límite es orientativo (lo muestra el POS en rojo), no un bloqueo:
        el dueño decide caso por caso si le sigue fiando a un cliente que ya
        lo superó — no lo decide el sistema por él."""
        self.cliente.limite_credito = Decimal("100")
        self.cliente.save()
        response = self._vender_fiado(monto_cuenta_corriente="200")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("200.00"))

    def test_permite_fiar_por_encima_del_limite_considerando_deuda_previa(self):
        self.cliente.saldo_actual = Decimal("900")
        self.cliente.save()
        response = self._vender_fiado(monto_cuenta_corriente="200")  # 900 + 200 > 1000
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("1100.00"))

    def test_anular_venta_fiada_revierte_la_deuda(self):
        venta = self._vender_fiado().data
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("200.00"))

        response = self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Error"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("0.00"))


class VentaEditarItemsTests(APITestCase):
    """El dueño se olvida de cargar algo, o el cliente se llevó de más/de
    menos, en una venta fiada ya cobrada: hay que poder corregirla sin pasar
    por anular + recargar, y que la diferencia le pegue a la deuda, no a la
    caja del día (que ya cerró o ya se contó)."""

    def setUp(self):
        self.mock_whatsapp = patch("clientes.views.enviar_whatsapp").start()
        self.addCleanup(patch.stopall)

        self.comercio = Comercio.objects.create(nombre="Comercio (test)", telefono="1155550000")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", precio_costo=Decimal("100"),
            precio_venta=Decimal("200"), stock=Decimal("50"),
        )
        self.balde = Producto.objects.create(
            comercio=self.comercio, nombre="Balde", precio_costo=Decimal("200"),
            precio_venta=Decimal("500"), stock=Decimal("20"),
        )
        self.cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Juan Fiado", celular="1155559999", limite_credito=Decimal("100000"),
        )

    def _vender(self, items, monto_cuenta_corriente, cliente=None, efectivo_recibido=None):
        return self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": items,
            "cliente": str((cliente or self.cliente).id),
            "monto_cuenta_corriente": monto_cuenta_corriente,
            "efectivo_recibido": efectivo_recibido,
        }, format="json")

    def test_agrega_producto_olvidado_y_suma_a_la_deuda(self):
        venta = self._vender(
            [{"producto": str(self.gaseosa.id), "cantidad": "1"}], monto_cuenta_corriente="200",
        ).data
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("49.000"))

        response = self.client.post(f"/api/ventas/{venta['id']}/editar_items/", {
            "items": [
                {"producto": str(self.gaseosa.id), "cantidad": "1"},
                {"producto": str(self.balde.id), "cantidad": "1"},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("700.00"))
        self.assertEqual(Decimal(response.data["monto_cuenta_corriente"]), Decimal("700.00"))

        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("700.00"))
        self.balde.refresh_from_db()
        self.assertEqual(self.balde.stock, Decimal("19.000"))
        # La gaseosa ya estaba y sigue en la venta: el stock no se toca dos veces.
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("49.000"))

    def test_reduce_cantidad_y_resta_de_la_deuda(self):
        venta = self._vender(
            [{"producto": str(self.gaseosa.id), "cantidad": "3"}], monto_cuenta_corriente="600",
        ).data
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("47.000"))

        response = self.client.post(f"/api/ventas/{venta['id']}/editar_items/", {
            "items": [{"producto": str(self.gaseosa.id), "cantidad": "1"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("200.00"))
        self.assertEqual(Decimal(response.data["monto_cuenta_corriente"]), Decimal("200.00"))

        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("200.00"))
        self.gaseosa.refresh_from_db()
        self.assertEqual(self.gaseosa.stock, Decimal("49.000"))

    def test_no_toca_lo_ya_cobrado_en_caja(self):
        # Total 200: 120 efectivo + 80 fiado. Se agrega un balde de $500, todo
        # a cuenta corriente — lo cobrado en el momento no se retoca.
        venta = self._vender(
            [{"producto": str(self.gaseosa.id), "cantidad": "1"}],
            monto_cuenta_corriente="80", efectivo_recibido="120",
        ).data
        ingreso_antes = CajaMovimiento.objects.get(sesion=self.caja_sesion, tipo="ingreso").monto

        response = self.client.post(f"/api/ventas/{venta['id']}/editar_items/", {
            "items": [
                {"producto": str(self.gaseosa.id), "cantidad": "1"},
                {"producto": str(self.balde.id), "cantidad": "1"},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["monto_cuenta_corriente"]), Decimal("580.00"))
        self.assertEqual(Decimal(response.data["monto_efectivo"]), Decimal("120.00"))

        ingreso_despues = CajaMovimiento.objects.get(sesion=self.caja_sesion, tipo="ingreso").monto
        self.assertEqual(ingreso_antes, ingreso_despues)
        self.assertEqual(CajaMovimiento.objects.filter(sesion=self.caja_sesion, tipo="ingreso").count(), 1)

    def test_no_deja_la_cuenta_corriente_en_negativo(self):
        venta = self._vender(
            [{"producto": str(self.gaseosa.id), "cantidad": "1"}],
            monto_cuenta_corriente="80", efectivo_recibido="120",
        ).data
        # Bajar el total muy por debajo de lo ya cobrado en efectivo dejaría
        # la cuenta corriente negativa: no tiene sentido, se rechaza.
        response = self.client.post(f"/api/ventas/{venta['id']}/editar_items/", {
            "items": [{"producto": str(self.gaseosa.id), "cantidad": "0.01"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal("80.00"), "no debe tocarse si la corrección se rechaza")

    def test_no_permite_editar_venta_sin_saldo_en_cuenta_corriente(self):
        venta = self._vender(
            [{"producto": str(self.gaseosa.id), "cantidad": "1"}],
            monto_cuenta_corriente="0", efectivo_recibido="200",
        ).data
        response = self.client.post(f"/api/ventas/{venta['id']}/editar_items/", {
            "items": [{"producto": str(self.balde.id), "cantidad": "1"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_permite_editar_venta_anulada(self):
        venta = self._vender(
            [{"producto": str(self.gaseosa.id), "cantidad": "1"}], monto_cuenta_corriente="200",
        ).data
        self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Error"}, format="json")

        response = self.client.post(f"/api/ventas/{venta['id']}/editar_items/", {
            "items": [{"producto": str(self.balde.id), "cantidad": "1"}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class VentaPorBolsaTests(APITestCase):
    """Un mismo producto por peso se puede vender suelto (por kg) o en bolsa
    cerrada, a precios distintos, pero el stock es uno solo en kg (ver
    ventas/views.py::_crear_venta) — este es el caso real de un cliente que
    compra bolsas de 20kg y las vende tanto enteras como sueltas."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.alimento = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento Balanceado Perro",
            precio_costo=Decimal("100"), precio_venta=Decimal("150"), stock=Decimal("100"),
            venta_por_peso=True, unidad_medida="kg",
            bolsa_kg=Decimal("20"), precio_bolsa=Decimal("2500"),
        )

    def test_vender_bolsa_y_kg_sueltos_en_la_misma_venta_descuenta_el_mismo_stock(self):
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [
                {"producto": str(self.alimento.id), "cantidad": "1", "es_bolsa": True},
                {"producto": str(self.alimento.id), "cantidad": "3", "es_bolsa": False},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # 1 bolsa a $2500 + 3kg a $150/kg = 2950
        self.assertEqual(Decimal(response.data["total"]), Decimal("2950.00"))

        self.alimento.refresh_from_db()
        self.assertEqual(self.alimento.stock, Decimal("77.000"), "100kg - 20kg (bolsa) - 3kg (suelto)")

        item_bolsa = Venta.objects.get(id=response.data["id"]).items.get(cantidad=Decimal("1.000"))
        self.assertEqual(item_bolsa.precio_unitario, Decimal("2500.00"))
        self.assertEqual(item_bolsa.peso_kg, Decimal("20.000"), "registra los kg reales descontados, no la cantidad de bolsas")
        self.assertEqual(item_bolsa.costo_unitario, Decimal("2000.00"), "costo por kg (100) * kg por bolsa (20)")

    def test_rechaza_bolsa_sin_stock_suficiente_en_kg(self):
        self.comercio.permitir_venta_sin_stock = False
        self.comercio.save(update_fields=["permitir_venta_sin_stock"])

        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.alimento.id), "cantidad": "6", "es_bolsa": True}],  # 6*20=120kg > 100kg
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.alimento.refresh_from_db()
        self.assertEqual(self.alimento.stock, Decimal("100.000"))

    def test_rechaza_venta_por_bolsa_si_el_producto_no_la_tiene_configurada(self):
        suelto = Producto.objects.create(
            comercio=self.comercio, nombre="Semilla suelta", precio_venta=Decimal("50"),
            stock=Decimal("100"), venta_por_peso=True, unidad_medida="kg",
        )
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(suelto.id), "cantidad": "1", "es_bolsa": True}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anular_venta_por_bolsa_repone_los_kg_reales_no_la_cantidad_de_bolsas(self):
        venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.alimento.id), "cantidad": "2", "es_bolsa": True}],
        }, format="json").data
        self.alimento.refresh_from_db()
        self.assertEqual(self.alimento.stock, Decimal("60.000"), "100kg - 2 bolsas * 20kg")

        response = self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "Devolución"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.alimento.refresh_from_db()
        self.assertEqual(
            self.alimento.stock, Decimal("100.000"),
            "tiene que devolver 40kg (2 bolsas), no 2 (la cantidad de bolsas)",
        )


class VentaFacturarTests(APITestCase):
    """Fase 7: pedir el CAE a ARCA para una venta ya cobrada. Nunca le pega a
    ARCA de verdad en los tests — se mockea fiscal.afip.solicitar_cae."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.gaseosa = Producto.objects.create(
            comercio=self.comercio, nombre="Gaseosa", precio_costo=Decimal("100"),
            precio_venta=Decimal("200"), stock=Decimal("50"),
        )
        self.venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.gaseosa.id), "cantidad": "1"}],
        }, format="json").data

    def _facturar(self):
        return self.client.post(f"/api/ventas/{self.venta['id']}/facturar/")

    def test_sin_config_fiscal_no_se_puede_facturar(self):
        response = self._facturar()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("fiscal.services.solicitar_cae")
    def test_facturar_exitoso_guarda_cae_en_la_venta_y_en_la_cola(self, mock_solicitar_cae):
        ComercioFiscalConfig.objects.create(
            comercio=self.comercio, cuit="20111111112", punto_venta="1",
            condicion_iva="monotributo", cert_ref="test", activo=True,
        )
        mock_solicitar_cae.return_value = {
            "cae": "75319871239871", "cae_vencimiento": "20260901",
            "numero": 42, "punto_vta": 1, "tipo_cbte": 11,
        }

        response = self._facturar()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["facturado"])
        self.assertEqual(response.data["cae"], "75319871239871")
        self.assertEqual(response.data["numero_factura"], "42")

        cola = FiscalQueue.objects.get(venta_id=self.venta["id"])
        self.assertEqual(cola.status, "ok")
        self.assertEqual(cola.cae, "75319871239871")

    @patch("fiscal.services.solicitar_cae")
    def test_rechazo_de_arca_deja_la_cola_en_error_y_la_venta_sin_facturar(self, mock_solicitar_cae):
        ComercioFiscalConfig.objects.create(
            comercio=self.comercio, cuit="20111111112", punto_venta="1",
            condicion_iva="monotributo", cert_ref="test", activo=True,
        )
        mock_solicitar_cae.side_effect = ErrorFiscal("CUIT del comprador inválido")

        response = self._facturar()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.venta_obj = Venta.objects.get(id=self.venta["id"])
        self.assertFalse(self.venta_obj.facturado)

        cola = FiscalQueue.objects.get(venta_id=self.venta["id"])
        self.assertEqual(cola.status, "error")
        self.assertIn("CUIT del comprador inválido", cola.error_msg)

    @patch("fiscal.services.solicitar_cae")
    def test_se_puede_reintentar_despues_de_un_error(self, mock_solicitar_cae):
        ComercioFiscalConfig.objects.create(
            comercio=self.comercio, cuit="20111111112", punto_venta="1",
            condicion_iva="monotributo", cert_ref="test", activo=True,
        )
        mock_solicitar_cae.side_effect = ErrorFiscal("ARCA no responde")
        self._facturar()

        mock_solicitar_cae.side_effect = None
        mock_solicitar_cae.return_value = {
            "cae": "75319871239871", "cae_vencimiento": "20260901",
            "numero": 1, "punto_vta": 1, "tipo_cbte": 11,
        }
        response = self._facturar()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(FiscalQueue.objects.filter(venta_id=self.venta["id"]).count(), 1, "reusa la misma fila de cola, no acumula")

    def test_no_se_puede_facturar_una_venta_anulada(self):
        self.client.post(f"/api/ventas/{self.venta['id']}/anular/", {"motivo": "x"}, format="json")
        response = self._facturar()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class HistorialSinNMasUnoTests(APITestCase):
    """El historial no puede hacer más consultas SQL porque haya más ventas.

    Antes de optimizar, listar 60 ventas disparaba ~450 consultas (una por
    cliente/vendedor/cuenta de pago de cada venta, y otra por el producto de
    cada ítem). El test compara el costo de listar pocas ventas contra el de
    listar muchas: si alguien saca un select_related/prefetch_related, el
    número crece con los datos y esto falla.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno_perf", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)

        self.cuenta = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        self.productos = [
            Producto.objects.create(
                comercio=self.comercio, nombre=f"Producto {i}",
                precio_costo=Decimal("100"), precio_venta=Decimal("200"), stock=Decimal("9999"),
            )
            for i in range(5)
        ]

    def _crear_ventas(self, cantidad):
        from .models import VentaItem

        for n in range(cantidad):
            cliente = Cliente.objects.create(comercio=self.comercio, nombre=f"Cliente {uuid.uuid4()}")
            venta = Venta.objects.create(
                comercio=self.comercio, cliente=cliente, cuenta_pago=self.cuenta,
                total=Decimal("1000"), metodo_pago="efectivo",
            )
            VentaItem.objects.bulk_create([
                VentaItem(
                    venta=venta, producto=p, cantidad=1,
                    precio_unitario=Decimal("200"), costo_unitario=Decimal("100"),
                    subtotal=Decimal("200"),
                )
                for p in self.productos
            ])

    def _consultas_al_listar(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/ventas/", {"page_size": 50})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return len(ctx.captured_queries)

    def test_listar_mas_ventas_no_hace_mas_consultas(self):
        self._crear_ventas(3)
        con_pocas = self._consultas_al_listar()

        self._crear_ventas(25)
        con_muchas = self._consultas_al_listar()

        self.assertEqual(
            con_pocas, con_muchas,
            f"El historial escala con los datos: {con_pocas} consultas con 3 ventas "
            f"y {con_muchas} con 28. Falta select_related/prefetch_related.",
        )


class VentaPagoMixtoTests(APITestCase):
    """Cobrar una venta con varios medios a la vez.

    Caso de referencia: $48.000 = $30.000 efectivo + $8.000 transferencia +
    $10.000 débito. Lo importante es que cada contenedor de caja reciba
    exactamente su parte, si no el arqueo del turno cierra con diferencia.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero_mixto", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        self.transferencia = CuentaPago.objects.create(comercio=self.comercio, nombre="Transferencia", tipo="transferencia")
        self.debito = CuentaPago.objects.create(comercio=self.comercio, nombre="Débito", tipo="tarjeta")

        # Un producto de $48.000 para que el total dé redondo.
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Bolsa grande", precio_costo=Decimal("20000"),
            precio_venta=Decimal("48000"), stock=Decimal("100"),
        )

    def _vender(self, pagos, **extra):
        payload = {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.producto.id), "cantidad": "1"}],
            "pagos": pagos,
        }
        payload.update(extra)
        return self.client.post("/api/ventas/", payload, format="json")

    def test_reparte_el_cobro_entre_los_tres_medios(self):
        response = self._vender([
            {"cuenta_pago": str(self.efectivo.id), "monto": "30000"},
            {"cuenta_pago": str(self.transferencia.id), "monto": "8000"},
            {"cuenta_pago": str(self.debito.id), "monto": "10000"},
        ])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("48000.00"))
        self.assertEqual(response.data["metodo_pago"], "mixto")

        pagos = {p["cuenta_pago_nombre"]: Decimal(p["monto"]) for p in response.data["pagos"]}
        self.assertEqual(pagos, {
            "Efectivo": Decimal("30000.00"),
            "Transferencia": Decimal("8000.00"),
            "Débito": Decimal("10000.00"),
        })

    def test_cada_contenedor_de_caja_recibe_su_parte(self):
        self._vender([
            {"cuenta_pago": str(self.efectivo.id), "monto": "30000"},
            {"cuenta_pago": str(self.transferencia.id), "monto": "8000"},
            {"cuenta_pago": str(self.debito.id), "monto": "10000"},
        ])
        movimientos = {
            m.cuenta_id: m.monto
            for m in CajaMovimiento.objects.filter(sesion=self.caja_sesion, tipo="ingreso")
        }
        self.assertEqual(movimientos[self.efectivo.id], Decimal("30000.00"))
        self.assertEqual(movimientos[self.transferencia.id], Decimal("8000.00"))
        self.assertEqual(movimientos[self.debito.id], Decimal("10000.00"))

    def test_completa_los_campos_por_tipo_de_medio(self):
        response = self._vender([
            {"cuenta_pago": str(self.efectivo.id), "monto": "30000"},
            {"cuenta_pago": str(self.transferencia.id), "monto": "8000"},
            {"cuenta_pago": str(self.debito.id), "monto": "10000"},
        ])
        self.assertEqual(Decimal(response.data["monto_efectivo"]), Decimal("30000.00"))
        self.assertEqual(Decimal(response.data["monto_transferencia"]), Decimal("8000.00"))
        self.assertEqual(Decimal(response.data["monto_tarjeta"]), Decimal("10000.00"))

    def test_rechaza_si_los_pagos_no_suman_el_total(self):
        response = self._vender([
            {"cuenta_pago": str(self.efectivo.id), "monto": "30000"},
            {"cuenta_pago": str(self.transferencia.id), "monto": "8000"},
        ])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pagos", response.data)
        self.assertEqual(Venta.objects.count(), 0, "no se registra una venta descuadrada")
        self.assertEqual(CajaMovimiento.objects.count(), 0)

    def test_rechaza_si_los_pagos_se_pasan_del_total(self):
        response = self._vender([
            {"cuenta_pago": str(self.efectivo.id), "monto": "48000"},
            {"cuenta_pago": str(self.debito.id), "monto": "5000"},
        ])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Venta.objects.count(), 0)

    def test_mixto_combinado_con_cuenta_corriente(self):
        """Lo fiado no es plata que entró: los pagos cubren sólo el resto."""
        cliente = Cliente.objects.create(
            comercio=self.comercio, nombre="Fiado SA", limite_credito=Decimal("100000"),
        )
        response = self._vender(
            [
                {"cuenta_pago": str(self.efectivo.id), "monto": "20000"},
                {"cuenta_pago": str(self.debito.id), "monto": "8000"},
            ],
            cliente=str(cliente.id),
            monto_cuenta_corriente="20000",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        entrado = CajaMovimiento.objects.filter(sesion=self.caja_sesion, tipo="ingreso").aggregate(
            t=models.Sum("monto")
        )["t"]
        self.assertEqual(entrado, Decimal("28000.00"), "sólo entra lo cobrado, no lo fiado")
        cliente.refresh_from_db()
        self.assertEqual(cliente.saldo_actual, Decimal("20000.00"))

    def test_anular_devuelve_a_cada_cuenta_lo_suyo(self):
        venta = self._vender([
            {"cuenta_pago": str(self.efectivo.id), "monto": "30000"},
            {"cuenta_pago": str(self.transferencia.id), "monto": "8000"},
            {"cuenta_pago": str(self.debito.id), "monto": "10000"},
        ]).data

        response = self.client.post(f"/api/ventas/{venta['id']}/anular/", {"motivo": "error de carga"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        for cuenta, esperado in ((self.efectivo, "30000.00"), (self.transferencia, "8000.00"), (self.debito, "10000.00")):
            egreso = CajaMovimiento.objects.get(sesion=self.caja_sesion, tipo="egreso", cuenta=cuenta)
            self.assertEqual(egreso.monto, Decimal(esperado))
            # Cada contenedor vuelve a cero: ingreso y egreso se cancelan.
            neto = (
                CajaMovimiento.objects.filter(sesion=self.caja_sesion, cuenta=cuenta, tipo="ingreso")
                .aggregate(t=models.Sum("monto"))["t"]
                - egreso.monto
            )
            self.assertEqual(neto, Decimal("0"))

    def test_sin_pagos_sigue_funcionando_como_antes(self):
        """La cola offline puede tener ventas guardadas con el formato viejo."""
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.producto.id), "cantidad": "1"}],
            "cuenta_pago": str(self.debito.id),
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        movimiento = CajaMovimiento.objects.get(sesion=self.caja_sesion, tipo="ingreso")
        self.assertEqual(movimiento.cuenta_id, self.debito.id)
        self.assertEqual(movimiento.monto, Decimal("48000.00"))


class VueltoPorOtraCuentaTests(APITestCase):
    """Vuelto dado por un medio distinto al que cobró (ej: cobra en efectivo,
    no hay billetes chicos y da el vuelto por transferencia). Sin esto, el
    cajón de efectivo queda de menos y la transferencia no refleja la salida
    real de esa plata — las estadísticas por medio de pago salen mal."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero_vuelto", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        self.caja_sesion = CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        self.efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        self.transferencia = CuentaPago.objects.create(comercio=self.comercio, nombre="Transferencia", tipo="transferencia")

        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado", precio_costo=Decimal("20000"),
            precio_venta=Decimal("48000"), stock=Decimal("100"),
        )

    def _vender(self, **extra):
        payload = {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(self.producto.id), "cantidad": "1"}],
            "efectivo_recibido": "50000",
        }
        payload.update(extra)
        return self.client.post("/api/ventas/", payload, format="json")

    def test_vuelto_por_otra_cuenta_ajusta_los_dos_contenedores(self):
        response = self._vender(vuelto_cuenta_pago=str(self.transferencia.id))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["vuelto"]), Decimal("2000.00"))
        self.assertEqual(response.data["vuelto_cuenta_pago_nombre"], "Transferencia")

        # Efectivo recibió el bruto: $48.000 de la venta + $2.000 que después
        # salieron de vuelto por otro medio = $50.000.
        ingreso_efectivo = CajaMovimiento.objects.filter(
            sesion=self.caja_sesion, cuenta=self.efectivo, tipo="ingreso"
        ).aggregate(t=models.Sum("monto"))["t"]
        self.assertEqual(ingreso_efectivo, Decimal("50000.00"))

        egreso_transferencia = CajaMovimiento.objects.get(
            sesion=self.caja_sesion, cuenta=self.transferencia, tipo="egreso"
        )
        self.assertEqual(egreso_transferencia.monto, Decimal("2000.00"))

    def test_sin_elegir_cuenta_de_vuelto_no_cambia_nada(self):
        """Default: se asume que el vuelto sale de la misma cuenta que cobró
        (efectivo) — comportamiento de siempre, sin movimientos extra."""
        response = self._vender()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["vuelto_cuenta_pago"])

        movimientos = CajaMovimiento.objects.filter(sesion=self.caja_sesion)
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos.first().monto, Decimal("48000.00"))

    def test_elegir_la_misma_cuenta_que_cobro_no_genera_movimientos_extra(self):
        response = self._vender(cuenta_pago=str(self.efectivo.id), vuelto_cuenta_pago=str(self.efectivo.id))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data["vuelto_cuenta_pago"])
        self.assertEqual(CajaMovimiento.objects.filter(sesion=self.caja_sesion).count(), 1)

    def test_anular_revierte_los_dos_contenedores(self):
        creada = self._vender(vuelto_cuenta_pago=str(self.transferencia.id))
        venta_id = creada.data["id"]

        response = self.client.post(f"/api/ventas/{venta_id}/anular/", {"motivo": "Error de carga"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        ingresos_efectivo = CajaMovimiento.objects.filter(
            sesion=self.caja_sesion, cuenta=self.efectivo, tipo="ingreso"
        ).aggregate(t=models.Sum("monto"))["t"]
        egresos_efectivo = CajaMovimiento.objects.filter(
            sesion=self.caja_sesion, cuenta=self.efectivo, tipo="egreso"
        ).aggregate(t=models.Sum("monto"))["t"]
        self.assertEqual(ingresos_efectivo, Decimal("50000.00"))
        # $48.000 de reversión de la venta + $2.000 de reversión del ajuste
        # bruto del vuelto = $50.000: el contenedor vuelve a cero.
        self.assertEqual(egresos_efectivo, Decimal("50000.00"))

        ingresos_transferencia = CajaMovimiento.objects.filter(
            sesion=self.caja_sesion, cuenta=self.transferencia, tipo="ingreso"
        ).aggregate(t=models.Sum("monto"))["t"]
        egresos_transferencia = CajaMovimiento.objects.filter(
            sesion=self.caja_sesion, cuenta=self.transferencia, tipo="egreso"
        ).aggregate(t=models.Sum("monto"))["t"]
        self.assertEqual(ingresos_transferencia, Decimal("2000.00"))
        self.assertEqual(egresos_transferencia, Decimal("2000.00"))


class VentaFraccionadaMetroYUnidadTests(APITestCase):
    """La venta fraccionada no es sólo para peso: la soga se corta por metro y
    los tornillos se venden de a uno, en los dos casos desde una presentación
    cerrada (el rollo, la caja) que también se puede vender entera.

    Es el mismo mecanismo que la bolsa de balanceado — estos tests fijan que
    funcione con unidad_medida="m" y "unidad", que es lo que pidió el cliente.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="cajero", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Cajero")
        self.client.force_authenticate(user=self.user)
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta")

        # Rollo de 15 m a $9.000; suelta, la soga sale $700 el metro.
        self.soga = Producto.objects.create(
            comercio=self.comercio, nombre="Soga de nylon 8mm",
            precio_costo=Decimal("400"), precio_venta=Decimal("700"), stock=Decimal("45"),
            venta_por_peso=True, unidad_medida="m",
            bolsa_kg=Decimal("15"), precio_bolsa=Decimal("9000"),
        )
        # Caja de 500 tornillos a $20.000; sueltos, $50 cada uno.
        self.tornillo = Producto.objects.create(
            comercio=self.comercio, nombre="Tornillo autoperforante 8x1",
            precio_costo=Decimal("25"), precio_venta=Decimal("50"), stock=Decimal("1500"),
            venta_por_peso=True, unidad_medida="unidad",
            bolsa_kg=Decimal("500"), precio_bolsa=Decimal("20000"),
        )

    def _vender(self, producto, cantidad, es_bolsa=False):
        return self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [{"producto": str(producto.id), "cantidad": str(cantidad), "es_bolsa": es_bolsa}],
        }, format="json")

    def test_vender_3_metros_de_soga_de_un_rollo(self):
        response = self._vender(self.soga, "3")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("2100.00"), "3 m a $700")

        self.soga.refresh_from_db()
        self.assertEqual(self.soga.stock, Decimal("42.000"), "45 m - 3 m")

    def test_vender_20_tornillos_sueltos_de_una_caja(self):
        response = self._vender(self.tornillo, "20")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("1000.00"), "20 tornillos a $50")

        self.tornillo.refresh_from_db()
        self.assertEqual(self.tornillo.stock, Decimal("1480.000"), "1500 - 20")

    def test_vender_el_rollo_entero_descuenta_sus_metros(self):
        response = self._vender(self.soga, "1", es_bolsa=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("9000.00"))

        self.soga.refresh_from_db()
        self.assertEqual(self.soga.stock, Decimal("30.000"), "45 m - 15 m del rollo")

    def test_vender_la_caja_entera_descuenta_sus_unidades(self):
        response = self._vender(self.tornillo, "1", es_bolsa=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("20000.00"))

        self.tornillo.refresh_from_db()
        self.assertEqual(self.tornillo.stock, Decimal("1000.000"), "1500 - 500 de la caja")

    def test_suelto_y_cerrado_salen_del_mismo_stock(self):
        """Lo importante del mecanismo: cortar 5 m y vender un rollo entero
        descuentan del mismo pozo, no de dos stocks separados."""
        response = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()),
            "items": [
                {"producto": str(self.soga.id), "cantidad": "5", "es_bolsa": False},
                {"producto": str(self.soga.id), "cantidad": "1", "es_bolsa": True},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # 5 m a $700 = 3.500 + rollo $9.000
        self.assertEqual(Decimal(response.data["total"]), Decimal("12500.00"))

        self.soga.refresh_from_db()
        self.assertEqual(self.soga.stock, Decimal("25.000"), "45 - 5 sueltos - 15 del rollo")

    def test_el_costo_del_envase_cerrado_es_por_su_contenido(self):
        """El margen del rollo tiene que compararse contra lo que costaron sus
        15 m, no contra el costo de un metro."""
        response = self._vender(self.soga, "1", es_bolsa=True)
        item = Venta.objects.get(id=response.data["id"]).items.first()
        self.assertEqual(item.costo_unitario, Decimal("6000.00"), "$400/m * 15 m")
        self.assertEqual(item.peso_kg, Decimal("15.000"), "registra los metros reales descontados")
