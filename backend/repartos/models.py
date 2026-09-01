from django.db import models

from caja.models import CuentaPago
from clientes.models import Cliente
from core.models import BaseModel, Perfil, TenantModel
from productos.models import Producto
from ventas.models import Venta


class Reparto(TenantModel):
    """Pedido a domicilio: qué se manda, a dónde y cuánto se cobra por llevarlo.

    Por sí solo NO toca stock ni caja: es la hoja de ruta, y un pedido cargado
    a la mañana no puede descontar mercadería que todavía no salió. El stock se
    mueve cuando se entrega y se factura, que es cuando se crea la Venta
    (ver RepartoViewSet.estado, que la linkea acá).
    """

    ESTADOS = [
        ("pendiente", "pendiente"),
        ("en_camino", "en camino"),
        ("entregado", "entregado"),
        ("cancelado", "cancelado"),
    ]

    # El cliente puede estar en la base (FK) o ser alguien de paso: `cliente_nombre`
    # siempre queda escrito para que el reparto se entienda solo.
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)
    cliente_nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    destino = models.CharField(max_length=300)
    fecha = models.DateField()
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    repartidor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    notas = models.CharField(max_length=300, blank=True)
    # Cómo se va a cobrar. Es la INTENCIÓN con la que sale el pedido: el
    # repartidor tiene que salir sabiendo si cobra, con qué, o si no cobra nada
    # porque va a la cuenta del cliente. Lo que de verdad entra a caja lo decide
    # la venta al facturar, que puede terminar siendo otra cosa.
    cuenta_pago = models.ForeignKey(CuentaPago, on_delete=models.SET_NULL, null=True, blank=True)
    # Excluyente con cuenta_pago: la cuenta corriente no es una cuenta de caja,
    # es deuda del cliente. Por eso exige un cliente registrado, no un nombre
    # suelto — mismo criterio que la venta fiada.
    a_cuenta_corriente = models.BooleanField(default=False)
    # Totales: se recalculan siempre en el servidor a partir de los ítems.
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    costo_envio = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    # Seteada al facturar el reparto: la venta real que salió de él. Sirve para
    # ir de uno al otro, para no cobrarlo dos veces, y para que las estadísticas
    # (que sólo miran Venta) vean esta plata. Mismo criterio que Presupuesto.
    venta = models.ForeignKey(Venta, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "-fecha"])]

    def __str__(self):
        return f"{self.cliente_nombre} — {self.destino}"


class RepartoItem(BaseModel):
    reparto = models.ForeignKey(Reparto, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, blank=True)
    # Igual que en VentaItem: si `es_bolsa`, `cantidad` son bolsas cerradas y
    # `precio_unitario` es el precio de la bolsa entera.
    cantidad = models.DecimalField(max_digits=14, decimal_places=3, default=1)
    es_bolsa = models.BooleanField(default=False)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
