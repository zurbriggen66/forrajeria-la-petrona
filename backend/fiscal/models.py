from django.db import models
from core.models import TenantModel
from ventas.models import Venta


def medios_de_pago(venta):
    """Tipos de medio con los que se cobró una venta: {'efectivo',
    'transferencia', ...}. Sale del desglose real (VentaPago) y no del texto
    `metodo_pago`, que en un pago mixto dice sólo "mixto".

    Lo fiado no pasa por ninguna cuenta, así que se deduce aparte."""
    tipos = {
        p.cuenta_pago.tipo
        for p in venta.pagos.all()
        if p.cuenta_pago_id and p.cuenta_pago.tipo
    }
    if venta.monto_cuenta_corriente and venta.monto_cuenta_corriente > 0:
        tipos.add("cuenta_corriente")
    return tipos


class ComercioFiscalConfig(TenantModel):
    CONDICIONES_IVA = [
        ("monotributo", "Monotributo"),
        ("responsable_inscripto", "Responsable Inscripto"),
        ("exento", "Exento"),
    ]
    cuit = models.CharField(max_length=20, blank=True)
    razon_social = models.CharField(max_length=200, blank=True)
    punto_venta = models.CharField(max_length=20, blank=True)
    condicion_iva = models.CharField(max_length=60, choices=CONDICIONES_IVA, blank=True)
    es_principal = models.BooleanField(default=False)
    # OJO: el certificado/clave AFIP NO va en texto plano acá. Guardar en un secret store
    # (variables de entorno, django-environ, o un gestor de secretos) y referenciar acá.
    # `cert_ref` es el nombre base de los archivos <cert_ref>.crt / <cert_ref>.key que el
    # deploy coloca a mano en backend/fiscal_certs/ (ver fiscal/afip.py) — no hay upload
    # por la web, es un paso de operaciones al configurar cada sucursal.
    cert_ref = models.CharField(max_length=200, blank=True)
    # True = homologación (ambiente de pruebas de ARCA, no factura de verdad). Pasar a
    # False recién cuando el certificado de producción esté cargado y confirmado.
    homologacion = models.BooleanField(default=True)
    activo = models.BooleanField(default=True)

    # --- Facturación automática -------------------------------------------
    # Qué ventas se facturan solas al cobrarlas, sin que el cajero apriete
    # "Facturar". Apagado por defecto: emitir un CAE es irreversible.
    facturar_automatico = models.BooleanField(default=False)
    # Tipos de CuentaPago que disparan la factura (efectivo | tarjeta |
    # transferencia | cuenta_corriente). Una venta con pago mixto entra si
    # CUALQUIERA de sus medios está en la lista: si algo entró por
    # transferencia, quedó registrado en el banco y hay que facturarlo.
    facturar_medios = models.JSONField(default=list, blank=True)
    # Piso opcional: 0 = sin mínimo.
    facturar_monto_minimo = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    def debe_facturarse(self, venta):
        """¿Esta venta entra en la regla de facturación automática?"""
        if not self.facturar_automatico or not self.activo:
            return False
        if venta.anulada or venta.facturado or venta.excluir_fiscal:
            return False
        if self.facturar_monto_minimo and venta.total < self.facturar_monto_minimo:
            return False
        medios = set(self.facturar_medios or [])
        if not medios:
            return False
        return bool(medios & medios_de_pago(venta))


class FiscalBatch(TenantModel):
    status = models.CharField(max_length=30, default="pendiente")
    cantidad = models.IntegerField(default=0)


class FiscalQueue(TenantModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, null=True, blank=True)
    batch = models.ForeignKey(FiscalBatch, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=30, default="pendiente")  # pendiente|procesando|ok|error
    cae = models.CharField(max_length=40, blank=True)
    cae_vencimiento = models.DateField(null=True, blank=True)
    punto_venta = models.CharField(max_length=20, blank=True)
    numero_factura = models.CharField(max_length=40, blank=True)
    tipo_comprobante = models.CharField(max_length=20, blank=True)
    error_msg = models.TextField(blank=True)
