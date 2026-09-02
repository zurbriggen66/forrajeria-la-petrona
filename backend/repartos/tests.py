import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaSesion
from clientes.models import Cliente
from core.models import Comercio, UsuarioComercio
from productos.models import Producto
from ventas.models import Venta

from .models import Reparto

User = get_user_model()


class RepartoTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        self.user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.cliente_registrado = Cliente.objects.create(comercio=self.comercio, nombre="Doña Rosa")

        # Balanceado: $2.000/kg suelto, bolsa de 20kg a $10.000.
        self.balanceado = Producto.objects.create(
            comercio=self.comercio, nombre="Balanceado perro", precio_venta=2000, precio_costo=400,
            venta_por_peso=True, unidad_medida="kg", bolsa_kg=20, precio_bolsa=10000, stock=500,
        )

    def _payload(self, **overrides):
        payload = {
            "cliente": str(self.cliente_registrado.id),
            "cliente_nombre": "Juan Pérez",
            "destino": "Belgrano 1234",
            "fecha": "2026-08-20",
            "costo_envio": "1500",
            "descuento": "0",
            "items": [{"producto": str(self.balanceado.id), "cantidad": "2", "es_bolsa": True}],
        }
        payload.update(overrides)
        return payload

    def test_crea_reparto_y_calcula_total_con_envio_y_descuento(self):
        response = self.client.post("/api/repartos/", self._payload(descuento="2000"), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # 2 bolsas x $10.000 = 20.000 − 2.000 descuento + 1.500 envío = 19.500
        self.assertEqual(Decimal(response.data["subtotal"]), Decimal("20000.00"))
        self.assertEqual(Decimal(response.data["total"]), Decimal("19500.00"))
        self.assertEqual(response.data["estado"], "pendiente")

    def test_cobra_el_precio_suelto_cuando_no_es_bolsa(self):
        response = self.client.post("/api/repartos/", self._payload(
            costo_envio="0",
            items=[{"producto": str(self.balanceado.id), "cantidad": "3.5", "es_bolsa": False}],
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # 3,5kg x $2.000 = $7.000 (precio suelto, no el de bolsa)
        self.assertEqual(Decimal(response.data["total"]), Decimal("7000.00"))

    def test_no_mueve_el_stock_del_producto(self):
        """El reparto es la hoja de ruta; el stock lo descuenta la venta en el
        POS. Si además descontara acá, el mismo pedido saldría dos veces."""
        self.client.post("/api/repartos/", self._payload(), format="json")
        self.balanceado.refresh_from_db()
        self.assertEqual(self.balanceado.stock, Decimal("500.000"))

    def test_rechaza_reparto_sin_productos(self):
        response = self.client.post("/api/repartos/", self._payload(items=[]), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechaza_descuento_mayor_al_subtotal(self):
        response = self.client.post("/api/repartos/", self._payload(descuento="999999"), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("descuento", response.data)

    def test_rechaza_bolsa_en_producto_sin_precio_de_bolsa(self):
        suelto = Producto.objects.create(
            comercio=self.comercio, nombre="Alpiste", precio_venta=800, venta_por_peso=True, unidad_medida="kg",
        )
        response = self.client.post("/api/repartos/", self._payload(
            items=[{"producto": str(suelto.id), "cantidad": "1", "es_bolsa": True}],
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambiar_estado(self):
        creado = self.client.post("/api/repartos/", self._payload(), format="json")
        reparto_id = creado.data["id"]
        response = self.client.post(f"/api/repartos/{reparto_id}/estado/", {"estado": "entregado"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Reparto.objects.get(id=reparto_id).estado, "entregado")

    def test_editar_reemplaza_los_items_y_recalcula(self):
        creado = self.client.post("/api/repartos/", self._payload(), format="json")
        reparto_id = creado.data["id"]
        response = self.client.put(f"/api/repartos/{reparto_id}/", self._payload(
            costo_envio="0",
            items=[{"producto": str(self.balanceado.id), "cantidad": "1", "es_bolsa": True}],
        ), format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Decimal(response.data["total"]), Decimal("10000.00"))
        self.assertEqual(Reparto.objects.get(id=reparto_id).items.count(), 1)

    def test_no_ve_repartos_de_otro_comercio(self):
        otro = Comercio.objects.create(nombre="Otro comercio")
        Reparto.objects.create(
            comercio=otro, cliente_nombre="Ajeno", destino="X 1", fecha="2026-08-20", total=100,
        )
        response = self.client.get("/api/repartos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)


class RepartoYStockTests(APITestCase):
    """Cuándo mueve stock un reparto y cómo queda marcada la venta.

    Un reparto pendiente es la hoja de ruta: no toca nada. Al entregarlo se
    factura, y esa venta es una venta real que descuenta stock y entra a caja.
    """

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        self.user = User.objects.create_user(username="dueno-rep", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        self.client.force_authenticate(user=self.user)
        self.cliente_registrado = Cliente.objects.create(comercio=self.comercio, nombre="Doña Rosa")
        CajaSesion.objects.create(comercio=self.comercio, estado="abierta", monto_apertura=Decimal("0"))

        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alfalfa", precio_venta=Decimal("3000.00"),
            precio_costo=Decimal("1800.0000"), stock=Decimal("50"),
        )

    def _stock(self):
        self.producto.refresh_from_db()
        return self.producto.stock

    def _repartir(self, cantidad="5", costo_envio="2500"):
        return self.client.post("/api/repartos/", {
            "cliente": str(self.cliente_registrado.id),
            "cliente_nombre": "Doña Rosa", "destino": "Belgrano 450", "fecha": "2026-09-01",
            "costo_envio": costo_envio, "descuento": "0",
            "items": [{"producto": str(self.producto.id), "cantidad": cantidad, "es_bolsa": False}],
        }, format="json")

    def _facturar(self, reparto_id, venta_id):
        return self.client.post(f"/api/repartos/{reparto_id}/estado/",
                                {"estado": "entregado", "venta": venta_id}, format="json")

    def _venta(self, cantidad="5", recargo="2500"):
        return self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()), "metodo_pago": "efectivo", "origen": "reparto",
            "recargo_monto": recargo,
            "items": [{"producto": str(self.producto.id), "cantidad": cantidad}],
        }, format="json")

    def test_cargar_un_reparto_no_mueve_stock(self):
        response = self._repartir()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["estado"], "pendiente")
        self.assertIsNone(response.data["venta"])
        self.assertEqual(self._stock(), Decimal("50.000"))

    def test_en_camino_tampoco_mueve_stock(self):
        reparto_id = self._repartir().data["id"]
        response = self.client.post(f"/api/repartos/{reparto_id}/estado/",
                                    {"estado": "en_camino"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(self._stock(), Decimal("50.000"))

    def test_facturarlo_descuenta_stock_marca_el_origen_y_cobra_el_envio(self):
        reparto_id = self._repartir().data["id"]

        venta = self._venta()
        self.assertEqual(venta.status_code, status.HTTP_201_CREATED, venta.data)
        self.assertEqual(venta.data["origen"], "reparto")
        # 5 × $3.000 de productos + $2.500 de envío como recargo.
        self.assertEqual(Decimal(venta.data["total"]), Decimal("17500.00"))
        self.assertEqual(self._stock(), Decimal("45.000"))

        response = self._facturar(reparto_id, venta.data["id"])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["estado"], "entregado")
        self.assertEqual(str(response.data["venta"]), str(venta.data["id"]))
        self.assertEqual(response.data["venta_numero_ticket"], venta.data["numero_ticket"])

    def test_no_se_puede_facturar_dos_veces(self):
        """Sin esta guarda, tocar "Facturar" dos veces descontaba el stock dos
        veces y dejaba dos ventas por el mismo pedido."""
        reparto_id = self._repartir().data["id"]
        self._facturar(reparto_id, self._venta().data["id"])
        segunda = self._facturar(reparto_id, self._venta().data["id"])
        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_acepta_una_venta_de_otro_comercio(self):
        reparto_id = self._repartir().data["id"]
        otro = Comercio.objects.create(nombre="Otro (test)")
        ajena = Venta.objects.create(comercio=otro, total=Decimal("100"), numero_ticket=1)
        response = self._facturar(reparto_id, str(ajena.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_entregar_sin_venta_deja_el_reparto_sin_facturar(self):
        """Es el caso de cerrar el modal de cobro: queda entregado, la pantalla
        lo avisa en ámbar y el botón "Facturar" sigue a mano."""
        reparto_id = self._repartir().data["id"]
        response = self.client.post(f"/api/repartos/{reparto_id}/estado/",
                                    {"estado": "entregado"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["estado"], "entregado")
        self.assertIsNone(response.data["venta"])
        self.assertEqual(self._stock(), Decimal("50.000"))

    def test_se_puede_cambiar_los_productos_antes_de_entregar(self):
        """El backend siempre lo soportaba (update rearma los ítems); era el
        formulario el que lo bloqueaba en cualquier edición."""
        creado = self._repartir(cantidad="5").data
        otro = Producto.objects.create(
            comercio=self.comercio, nombre="Maíz", precio_venta=Decimal("1000.00"),
            precio_costo=Decimal("600.0000"), stock=Decimal("80"),
        )
        response = self.client.put(f"/api/repartos/{creado['id']}/", {
            "cliente": str(self.cliente_registrado.id),
            "cliente_nombre": "Doña Rosa", "destino": "Belgrano 450", "fecha": "2026-09-01",
            "costo_envio": "2500", "descuento": "0", "estado": "pendiente",
            "items": [
                {"producto": str(self.producto.id), "cantidad": "2", "es_bolsa": False},
                {"producto": str(otro.id), "cantidad": "3", "es_bolsa": False},
            ],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(len(response.data["items"]), 2)
        # 2 × 3.000 + 3 × 1.000 = 9.000 de productos
        self.assertEqual(Decimal(response.data["subtotal"]), Decimal("9000.00"))
        # Editar no toca stock: el reparto sigue sin facturar.
        self.assertEqual(self._stock(), Decimal("50.000"))

    def test_el_item_trae_los_precios_vigentes_para_el_formulario(self):
        """El formulario de edición los usa para recalcular la línea; con sólo
        `precio_unitario` (el congelado de aquel día) no podía."""
        item = self._repartir().data["items"][0]
        self.assertEqual(Decimal(item["producto_precio_venta"]), Decimal("3000.00"))
        self.assertIsNone(item["producto_precio_bolsa"])

    def test_se_guarda_con_que_se_va_a_cobrar(self):
        from caja.models import CuentaPago
        efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        response = self.client.post("/api/repartos/", {
            "cliente": str(self.cliente_registrado.id),
            "cliente_nombre": "Doña Rosa", "destino": "Belgrano 450", "fecha": "2026-09-01",
            "costo_envio": "2500", "descuento": "0", "cuenta_pago": str(efectivo.id),
            "items": [{"producto": str(self.producto.id), "cantidad": "2", "es_bolsa": False}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["cuenta_pago_nombre"], "Efectivo")
        self.assertFalse(response.data["a_cuenta_corriente"])

    def test_un_reparto_exige_un_cliente_de_la_lista(self):
        """Con el nombre suelto no alcanza: el reparto tiene que quedar en la
        ficha de alguien para poder fiarlo, verlo en su historial y avisarle."""
        response = self.client.post("/api/repartos/", {
            "cliente_nombre": "Un señor", "destino": "Belgrano 450", "fecha": "2026-09-01",
            "costo_envio": "0", "descuento": "0",
            "items": [{"producto": str(self.producto.id), "cantidad": "1", "es_bolsa": False}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cliente", response.data)

    def test_cuenta_corriente_con_cliente_registrado_entra(self):
        from clientes.models import Cliente
        cliente = Cliente.objects.create(comercio=self.comercio, nombre="Doña Rosa")
        response = self.client.post("/api/repartos/", {
            "cliente": str(cliente.id), "cliente_nombre": "Doña Rosa", "destino": "Belgrano 450",
            "fecha": "2026-09-01", "costo_envio": "0", "descuento": "0", "a_cuenta_corriente": True,
            "items": [{"producto": str(self.producto.id), "cantidad": "1", "es_bolsa": False}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["a_cuenta_corriente"])
        self.assertIsNone(response.data["cuenta_pago"])

    def test_no_se_puede_elegir_medio_de_pago_y_cuenta_corriente_a_la_vez(self):
        from caja.models import CuentaPago
        from clientes.models import Cliente
        efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        cliente = Cliente.objects.create(comercio=self.comercio, nombre="Doña Rosa")
        response = self.client.post("/api/repartos/", {
            "cliente": str(cliente.id), "cliente_nombre": "Doña Rosa", "destino": "Belgrano 450",
            "fecha": "2026-09-01", "costo_envio": "0", "descuento": "0",
            "a_cuenta_corriente": True, "cuenta_pago": str(efectivo.id),
            "items": [{"producto": str(self.producto.id), "cantidad": "1", "es_bolsa": False}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_acepta_una_cuenta_de_pago_de_otro_comercio(self):
        from caja.models import CuentaPago
        otro = Comercio.objects.create(nombre="Otro (test)")
        ajena = CuentaPago.objects.create(comercio=otro, nombre="Efectivo ajeno", tipo="efectivo")
        response = self.client.post("/api/repartos/", {
            "cliente": str(self.cliente_registrado.id),
            "cliente_nombre": "Doña Rosa", "destino": "Belgrano 450", "fecha": "2026-09-01",
            "costo_envio": "0", "descuento": "0", "cuenta_pago": str(ajena.id),
            "items": [{"producto": str(self.producto.id), "cantidad": "1", "es_bolsa": False}],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_la_plata_del_reparto_facturado_entra_a_la_caja(self):
        """La venta del reparto es una venta normal, así que pasa por el mismo
        camino que el mostrador: descuenta stock Y entra al arqueo del turno."""
        from caja.models import CajaMovimiento, CuentaPago
        efectivo = CuentaPago.objects.create(comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        reparto_id = self._repartir(cantidad="5", costo_envio="2500").data["id"]

        venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()), "metodo_pago": "efectivo", "origen": "reparto",
            "cuenta_pago": str(efectivo.id), "recargo_monto": "2500",
            "items": [{"producto": str(self.producto.id), "cantidad": "5"}],
        }, format="json")
        self.assertEqual(venta.status_code, status.HTTP_201_CREATED, venta.data)
        self._facturar(reparto_id, venta.data["id"])

        ingresos = CajaMovimiento.objects.filter(comercio=self.comercio, tipo="ingreso")
        self.assertEqual(sum((m.monto for m in ingresos), Decimal("0")), Decimal("17500.00"))
        self.assertIn("Venta", ingresos.first().concepto)

    def test_un_reparto_fiado_no_entra_a_la_caja_sino_a_la_deuda(self):
        """Si va a cuenta corriente no entró plata: va contra el saldo del
        cliente. Meterlo en el arqueo lo dejaría inflado."""
        from caja.models import CajaMovimiento
        from clientes.models import Cliente
        cliente = Cliente.objects.create(comercio=self.comercio, nombre="Doña Rosa")
        reparto_id = self._repartir(cantidad="5", costo_envio="0").data["id"]

        venta = self.client.post("/api/ventas/", {
            "sync_uuid": str(uuid.uuid4()), "metodo_pago": "cuenta_corriente", "origen": "reparto",
            "cliente": str(cliente.id), "monto_cuenta_corriente": "15000",
            "items": [{"producto": str(self.producto.id), "cantidad": "5"}],
        }, format="json")
        self.assertEqual(venta.status_code, status.HTTP_201_CREATED, venta.data)
        self._facturar(reparto_id, venta.data["id"])

        self.assertEqual(CajaMovimiento.objects.filter(tipo="ingreso").count(), 0)
        cliente.refresh_from_db()
        self.assertEqual(cliente.saldo_actual, Decimal("15000.00"))

    def test_cobrar_por_adelantado_no_lo_marca_entregado(self):
        """El cliente paga al encargarlo y el pedido sale después. La venta ya
        existe (descuenta stock y entra a caja) pero el reparto sigue pendiente:
        son dos ejes distintos y confundirlos hace que se cobre dos veces."""
        reparto_id = self._repartir(cantidad="5").data["id"]
        venta = self._venta()
        response = self.client.post(f"/api/repartos/{reparto_id}/estado/",
                                    {"estado": "pendiente", "venta": venta.data["id"]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["estado"], "pendiente")
        self.assertEqual(str(response.data["venta"]), str(venta.data["id"]))
        # Ya descontó stock, porque la venta se hizo.
        self.assertEqual(self._stock(), Decimal("45.000"))

    def test_un_pedido_ya_pagado_no_se_puede_cobrar_de_nuevo_al_entregar(self):
        """La guarda que evita el cobro doble: al marcarlo entregado, la
        pantalla ya no ofrece facturar, y el endpoint rechaza otra venta."""
        reparto_id = self._repartir(cantidad="5").data["id"]
        self.client.post(f"/api/repartos/{reparto_id}/estado/",
                         {"estado": "pendiente", "venta": self._venta().data["id"]}, format="json")

        # Entregarlo después no necesita venta y no la pide.
        entregado = self.client.post(f"/api/repartos/{reparto_id}/estado/",
                                     {"estado": "entregado"}, format="json")
        self.assertEqual(entregado.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(entregado.data["venta"])

        # Y si alguien intentara linkear otra venta, se rechaza.
        segunda = self.client.post(f"/api/repartos/{reparto_id}/estado/",
                                   {"estado": "entregado", "venta": self._venta().data["id"]}, format="json")
        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)
