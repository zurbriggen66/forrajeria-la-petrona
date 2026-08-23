from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from caja.models import CuentaPago
from core.models import Comercio
from productos.models import Producto
from ventas.models import Venta, VentaItem, VentaPago

from .afip import FACTURA_B, FACTURA_C, ErrorFiscal, solicitar_cae
from .models import ComercioFiscalConfig, FiscalQueue
from .services import facturar_si_corresponde


class SolicitarCaeTests(TestCase):
    """ARCA rechaza (10047/10048/10071) una Factura C con IVA discriminado:
    un monotributista no lo factura por separado. Se prueba mockeando WSFEv1
    (no se puede pegarle a ARCA real en un test) — ver fiscal/afip.py."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.producto = Producto.objects.create(
            comercio=self.comercio, nombre="Alimento", precio_costo=Decimal("100"),
            precio_venta=Decimal("121"), stock=Decimal("50"), alicuota_iva=Decimal("21"),
        )
        self.venta = Venta.objects.create(comercio=self.comercio, total=Decimal("121"), numero_ticket=1)
        VentaItem.objects.create(
            venta=self.venta, producto=self.producto, cantidad=Decimal("1"),
            precio_unitario=Decimal("121"), subtotal=Decimal("121"),
        )

    def _mockear_wsfe(self, mock_wsfev1_cls):
        wsfe = mock_wsfev1_cls.return_value
        wsfe.CompUltimoAutorizado.return_value = 5
        wsfe.CAE = "12345"
        wsfe.Vencimiento = "20260901"
        wsfe.CAESolicitar.return_value = True
        return wsfe

    @patch("fiscal.afip._rutas_certificado", return_value=("cert.crt", "cert.key"))
    @patch("fiscal.afip._obtener_ticket", return_value={"token": "t", "sign": "s"})
    @patch("fiscal.afip.WSFEv1")
    def test_factura_c_no_discrimina_iva(self, mock_wsfev1_cls, mock_ticket, mock_certs):
        config = ComercioFiscalConfig.objects.create(
            comercio=self.comercio, cuit="20458023426", punto_venta="2",
            condicion_iva="monotributo", cert_ref="test",
        )
        wsfe = self._mockear_wsfe(mock_wsfev1_cls)

        resultado = solicitar_cae(self.venta, config)

        _, kwargs = wsfe.CrearFactura.call_args
        self.assertEqual(kwargs["tipo_cbte"], FACTURA_C)
        self.assertEqual(kwargs["imp_iva"], 0.0)
        self.assertEqual(kwargs["imp_neto"], float(self.venta.total))
        wsfe.AgregarIva.assert_not_called()
        self.assertEqual(resultado["cae"], "12345")

    @patch("fiscal.afip._rutas_certificado", return_value=("cert.crt", "cert.key"))
    @patch("fiscal.afip._obtener_ticket", return_value={"token": "t", "sign": "s"})
    @patch("fiscal.afip.WSFEv1")
    def test_factura_b_si_discrimina_iva(self, mock_wsfev1_cls, mock_ticket, mock_certs):
        config = ComercioFiscalConfig.objects.create(
            comercio=self.comercio, cuit="20458023426", punto_venta="2",
            condicion_iva="responsable_inscripto", cert_ref="test",
        )
        wsfe = self._mockear_wsfe(mock_wsfev1_cls)

        resultado = solicitar_cae(self.venta, config)

        _, kwargs = wsfe.CrearFactura.call_args
        self.assertEqual(kwargs["tipo_cbte"], FACTURA_B)
        self.assertGreater(kwargs["imp_iva"], 0)
        wsfe.AgregarIva.assert_called_once()
        self.assertEqual(resultado["cae"], "12345")


class FacturacionAutomaticaTests(TestCase):
    """Regla de facturación automática: qué ventas entran y qué pasa cuando
    ARCA no responde. Lo que se prueba es la decisión, no la emisión en sí
    (eso ya está cubierto arriba con el mock de WSFEv1)."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.efectivo = CuentaPago.objects.create(
            comercio=self.comercio, nombre="Efectivo", tipo="efectivo")
        self.transferencia = CuentaPago.objects.create(
            comercio=self.comercio, nombre="Transferencia", tipo="transferencia")
        self.config = ComercioFiscalConfig.objects.create(
            comercio=self.comercio, cuit="20111111112", punto_venta="1",
            condicion_iva="monotributo", activo=True,
            facturar_automatico=True, facturar_medios=["transferencia"],
        )

    def _venta(self, total="10000", pagos=None, cuenta_corriente="0"):
        venta = Venta.objects.create(
            comercio=self.comercio, total=Decimal(total), numero_ticket=1,
            monto_cuenta_corriente=Decimal(cuenta_corriente),
        )
        for cuenta, monto in (pagos or []):
            VentaPago.objects.create(venta=venta, cuenta_pago=cuenta, monto=Decimal(monto))
        return venta

    def test_factura_la_venta_por_transferencia(self):
        venta = self._venta(pagos=[(self.transferencia, "10000")])
        self.assertTrue(self.config.debe_facturarse(venta))

    def test_no_factura_la_venta_en_efectivo(self):
        venta = self._venta(pagos=[(self.efectivo, "10000")])
        self.assertFalse(self.config.debe_facturarse(venta))

    def test_pago_mixto_entra_si_alguna_parte_fue_por_el_medio_elegido(self):
        """Si algo entró por transferencia quedó registrado en el banco, así
        que la venta se factura aunque el resto haya sido en efectivo."""
        venta = self._venta(pagos=[(self.efectivo, "9000"), (self.transferencia, "1000")])
        self.assertTrue(self.config.debe_facturarse(venta))

    def test_respeta_el_monto_minimo(self):
        self.config.facturar_monto_minimo = Decimal("50000")
        venta = self._venta(total="10000", pagos=[(self.transferencia, "10000")])
        self.assertFalse(self.config.debe_facturarse(venta), "no llega al mínimo")
        grande = self._venta(total="60000", pagos=[(self.transferencia, "60000")])
        self.assertTrue(self.config.debe_facturarse(grande))

    def test_cuenta_corriente_cuenta_como_medio(self):
        self.config.facturar_medios = ["cuenta_corriente"]
        venta = self._venta(cuenta_corriente="10000")
        self.assertTrue(self.config.debe_facturarse(venta))

    def test_no_factura_si_esta_apagado_o_ya_facturada_o_anulada(self):
        venta = self._venta(pagos=[(self.transferencia, "10000")])
        self.config.facturar_automatico = False
        self.assertFalse(self.config.debe_facturarse(venta))

        self.config.facturar_automatico = True
        venta.facturado = True
        self.assertFalse(self.config.debe_facturarse(venta))

        venta.facturado = False
        venta.anulada = True
        self.assertFalse(self.config.debe_facturarse(venta))

    def test_sin_medios_elegidos_no_factura_nada(self):
        """Prendido pero sin marcar ningún medio no puede significar "todos":
        emitir un CAE es irreversible."""
        self.config.facturar_medios = []
        venta = self._venta(pagos=[(self.transferencia, "10000")])
        self.assertFalse(self.config.debe_facturarse(venta))

    @patch("fiscal.services.solicitar_cae")
    def test_si_arca_falla_la_venta_sobrevive_y_queda_pendiente(self, mock_cae):
        """Lo más importante: un problema con ARCA no puede romper una venta
        que el cliente ya pagó."""
        mock_cae.side_effect = ErrorFiscal("ARCA no responde")
        venta = self._venta(pagos=[(self.transferencia, "10000")])

        self.assertFalse(facturar_si_corresponde(venta))
        venta.refresh_from_db()
        self.assertFalse(venta.facturado)
        item = FiscalQueue.objects.get(venta=venta)
        self.assertEqual(item.status, "error", "queda en la cola para reintentar")
        self.assertIn("ARCA no responde", item.error_msg)
