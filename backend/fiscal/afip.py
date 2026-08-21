"""Wrapper fino sobre pyafipws (WSAA + WSFEv1) para pedir un CAE.

Homologación por defecto (`ComercioFiscalConfig.homologacion=True`) — para pasar a
producción real no se toca este archivo, solo esa config una vez que el
certificado de producción esté cargado en fiscal_certs/.
"""
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.cache import cache

from pyafipws.wsaa import WSAA
from pyafipws.wsfev1 import WSFEv1

WSAA_URL_HOMO = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"
WSAA_URL_PROD = "https://wsaa.afip.gov.ar/ws/services/LoginCms"
WSFE_URL_HOMO = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL"
WSFE_URL_PROD = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL"

CERTS_DIR = Path(settings.BASE_DIR) / "fiscal_certs"

FACTURA_A, FACTURA_B, FACTURA_C = 1, 6, 11
# Código de alícuota de IVA de ARCA por porcentaje (los que puede tener un Producto).
IVA_ID_POR_ALICUOTA = {
    Decimal("0"): 3,
    Decimal("10.5"): 4,
    Decimal("21"): 5,
    Decimal("27"): 6,
}


class ErrorFiscal(Exception):
    """Rechazo de ARCA o error de comunicación al pedir un CAE."""


def _rutas_certificado(config):
    if not config.cert_ref:
        raise ErrorFiscal("El comercio no tiene un certificado configurado (cert_ref vacío).")
    cert = CERTS_DIR / f"{config.cert_ref}.crt"
    key = CERTS_DIR / f"{config.cert_ref}.key"
    if not cert.exists() or not key.exists():
        raise ErrorFiscal(f"No se encontró el certificado/clave para '{config.cert_ref}' en fiscal_certs/.")
    return str(cert), str(key)


def _obtener_ticket(config):
    """Token+Sign de WSAA para el CUIT de `config`, cacheados ~11hs (el ticket
    real vence a las 12hs — se pide de nuevo antes de llegar al límite)."""
    cache_key = f"wsaa-ticket:{config.cuit}:{config.homologacion}"
    ticket = cache.get(cache_key)
    if ticket:
        return ticket

    cert, key = _rutas_certificado(config)
    url = WSAA_URL_HOMO if config.homologacion else WSAA_URL_PROD

    wsaa = WSAA()
    try:
        ticket_xml = wsaa.Autenticar("wsfe", cert, key, wsdl=url)
    except Exception as exc:
        raise ErrorFiscal(f"No se pudo autenticar con ARCA (WSAA): {exc}") from exc
    if not ticket_xml:
        raise ErrorFiscal(f"WSAA rechazó la autenticación: {wsaa.Excepcion or wsaa.LeerError()}")

    ticket = {"token": wsaa.Token, "sign": wsaa.Sign}
    cache.set(cache_key, ticket, timeout=11 * 60 * 60)
    return ticket


def _tipo_comprobante(config, venta):
    """Simplificado: no consulta el padrón de ARCA para la condición IVA real
    del comprador, solo si cargamos un CUIT en el cliente de la venta. Cubre
    el caso típico de un comercio chico (mayoría consumidor final)."""
    if config.condicion_iva == "monotributo":
        return FACTURA_C
    cliente = venta.cliente
    if config.condicion_iva == "responsable_inscripto" and cliente and cliente.cuit:
        return FACTURA_A
    return FACTURA_B


def _totales_por_alicuota(venta):
    """Neto/IVA agrupado por alícuota a partir de los items, prorrateando
    descuento/recargo para que neto+iva cierre exacto con venta.total (ARCA
    valida esa suma de forma estricta)."""
    items = list(venta.items.select_related("producto"))
    bruto_items = sum((item.subtotal for item in items), Decimal("0")) or Decimal("1")
    factor = venta.total / bruto_items

    grupos: dict[Decimal, list[Decimal]] = {}
    for item in items:
        alicuota = item.producto.alicuota_iva if item.producto else Decimal("21")
        ajustado = item.subtotal * factor
        neto = (ajustado / (1 + alicuota / 100)).quantize(Decimal("0.01"))
        iva = (ajustado - neto).quantize(Decimal("0.01"))
        acumulado = grupos.setdefault(alicuota, [Decimal("0"), Decimal("0")])
        acumulado[0] += neto
        acumulado[1] += iva
    return grupos


def solicitar_cae(venta, config):
    """Pide el CAE a WSFEv1 para una Venta ya creada.

    Devuelve dict con cae/cae_vencimiento/numero/tipo_cbte/punto_vta, o
    levanta ErrorFiscal (rechazo de ARCA o problema de comunicación) — nunca
    deja la Venta en un estado a medias, eso lo maneja el caller.
    """
    if not config.punto_venta or not config.cuit:
        raise ErrorFiscal("Falta configurar CUIT o punto de venta del comercio.")

    ticket = _obtener_ticket(config)
    cert, key = _rutas_certificado(config)

    wsfe = WSFEv1()
    wsfe.Token = ticket["token"]
    wsfe.Sign = ticket["sign"]
    wsfe.Cuit = config.cuit
    url = WSFE_URL_HOMO if config.homologacion else WSFE_URL_PROD
    try:
        # cacert=True: usa el bundle de CAs públicas (certifi) para verificar
        # el servidor de ARCA. NO es el certificado del cliente (`cert`) —
        # ese sirve para autenticar contra WSAA, no para validar el server.
        wsfe.Conectar(wsdl=url, cacert=True)
    except Exception as exc:
        raise ErrorFiscal(f"No se pudo conectar a WSFEv1: {exc}") from exc

    punto_vta = int(config.punto_venta)
    tipo_cbte = _tipo_comprobante(config, venta)

    try:
        ultimo = wsfe.CompUltimoAutorizado(tipo_cbte, punto_vta)
    except Exception as exc:
        raise ErrorFiscal(f"No se pudo consultar el último comprobante autorizado: {exc}") from exc
    numero = int(ultimo or 0) + 1

    # Un monotributista no discrimina IVA: ARCA rechaza (10047/10048/10071) si
    # una Factura C trae imp_iva != 0 o un detalle de AgregarIva. Todo el
    # importe va como neto, sin desglose por alícuota.
    if tipo_cbte == FACTURA_C:
        grupos = {}
        imp_neto = venta.total
        imp_iva = Decimal("0")
    else:
        grupos = _totales_por_alicuota(venta)
        imp_neto = sum((g[0] for g in grupos.values()), Decimal("0"))
        imp_iva = sum((g[1] for g in grupos.values()), Decimal("0"))

    wsfe.CrearFactura(
        concepto=1,  # productos
        tipo_doc=99, nro_doc=0,  # consumidor final sin documento (default retail)
        tipo_cbte=tipo_cbte, punto_vta=punto_vta,
        cbt_desde=numero, cbt_hasta=numero,
        imp_total=float(venta.total), imp_neto=float(imp_neto), imp_iva=float(imp_iva),
        imp_tot_conc=0, imp_op_ex=0, imp_trib=0,
        fecha_cbte=venta.created_at.strftime("%Y%m%d"),
        moneda_id="PES", moneda_ctz="1.0000",
    )
    for alicuota, (neto, iva) in grupos.items():
        iva_id = IVA_ID_POR_ALICUOTA.get(alicuota, 5)
        wsfe.AgregarIva(iva_id=iva_id, base_imp=float(neto), importe=float(iva))

    try:
        ok = wsfe.CAESolicitar()
    except Exception as exc:
        raise ErrorFiscal(f"Error al pedir el CAE: {exc}") from exc
    if not ok or not wsfe.CAE:
        raise ErrorFiscal(wsfe.ErrMsg or wsfe.Obs or "ARCA rechazó el comprobante.")

    return {
        "cae": wsfe.CAE,
        "cae_vencimiento": wsfe.Vencimiento,
        "numero": numero,
        "punto_vta": punto_vta,
        "tipo_cbte": tipo_cbte,
    }
