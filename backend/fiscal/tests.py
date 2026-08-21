from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from core.models import Comercio
from productos.models import Producto
from ventas.models import Venta, VentaItem

from .afip import FACTURA_B, FACTURA_C, solicitar_cae
from .models import ComercioFiscalConfig


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
