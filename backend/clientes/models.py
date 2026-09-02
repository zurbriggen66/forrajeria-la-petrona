from django.db import models
from core.models import TenantModel, Perfil


class Cliente(TenantModel):
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    celular = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    cuit = models.CharField(max_length=20, blank=True)
    direccion = models.CharField(max_length=300, blank=True)
    tipo = models.CharField(max_length=40, default="consumidor_final")
    saldo_actual = models.DecimalField(max_digits=14, decimal_places=2, default=0)  # cta corriente
    limite_credito = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    kubobots_fid_off = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


MEDIOS_PAGO = [
    ("efectivo", "Efectivo"),
    ("transferencia", "Transferencia"),
    ("tarjeta", "Tarjeta"),
]


class ClienteMovimiento(TenantModel):
    """Cuenta corriente del cliente: ventas 'fiadas' (cargo) y pagos que hace
    para saldarlas, ídem ProveedorMovimiento pero en sentido inverso — acá el
    saldo es lo que el cliente le debe al comercio."""
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="movimientos")
    tipo = models.CharField(max_length=30)  # cargo | pago | ajuste
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    referencia = models.CharField(max_length=120, blank=True)
    medio_pago = models.CharField(max_length=20, choices=MEDIOS_PAGO, blank=True)  # solo aplica a tipo=pago
    # Dónde entró la plata de este movimiento. Sólo lo llenan los PAGOS: un
    # cargo (fiado) y un ajuste no mueven plata física, así que no pueden tocar
    # el arqueo — si lo hicieran, la caja cerraría con diferencia todos los días.
    #
    # Quedan en null si en ese momento no había caja abierta: el pago se
    # registra igual (mismo criterio que un gasto o un pago a proveedor), pero
    # entonces no está en el arqueo de ningún turno.
    caja_sesion = models.ForeignKey(
        "caja.CajaSesion", on_delete=models.SET_NULL, null=True, blank=True,
    )
    cuenta_pago = models.ForeignKey(
        "caja.CuentaPago", on_delete=models.SET_NULL, null=True, blank=True,
    )


class MovimientoAuditoria(TenantModel):
    """Rastro de las ediciones y borrados en la cuenta corriente de un cliente.

    Existe porque un pago se podía corregir o borrar sin motivo y sin dejar
    huella: el saldo del cliente cambiaba y no quedaba forma de saber quién lo
    tocó, cuánto era antes ni por qué. En una cuenta corriente eso es la
    diferencia entre un error y una discusión sin pruebas.

    Se guarda TODO en copia (nombre del cliente, montos, referencia) y no por
    FK al movimiento: el movimiento borrado ya no existe, y el rastro tiene que
    seguir leyéndose igual. Por eso `cliente` es SET_NULL con el nombre al lado.
    """

    ACCIONES = [("editado", "editado"), ("eliminado", "eliminado")]

    cliente = models.ForeignKey(
        Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name="auditorias",
    )
    cliente_nombre = models.CharField(max_length=200)
    accion = models.CharField(max_length=20, choices=ACCIONES)
    motivo = models.CharField(max_length=300)
    # Id del movimiento tocado. Sin FK a propósito (ver docstring).
    movimiento_id = models.UUIDField()
    tipo = models.CharField(max_length=30)

    monto_anterior = models.DecimalField(max_digits=14, decimal_places=2)
    referencia_anterior = models.CharField(max_length=120, blank=True)
    medio_pago_anterior = models.CharField(max_length=20, blank=True)

    # Vacíos cuando la acción fue "eliminado".
    monto_nuevo = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    referencia_nueva = models.CharField(max_length=120, blank=True)
    medio_pago_nuevo = models.CharField(max_length=20, blank=True)

    # El saldo del cliente antes y después: es el número por el que se pregunta
    # cuando hay que reconstruir qué pasó.
    saldo_anterior = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    saldo_nuevo = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    hecho_por = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["comercio", "-created_at"])]

    def __str__(self):
        return f"{self.accion} — {self.cliente_nombre} — {self.motivo[:40]}"


class ClienteAsignacion(TenantModel):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE)
    vendedor = models.ForeignKey(Perfil, on_delete=models.SET_NULL, null=True, blank=True)
    activo = models.BooleanField(default=True)


class CrmLead(TenantModel):
    nombre = models.CharField(max_length=200, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    estado = models.CharField(max_length=40, default="nuevo")
    notas = models.TextField(blank=True)
