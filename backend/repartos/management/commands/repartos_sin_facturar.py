"""Repartos entregados que no tienen venta: el arrastre de antes de que
entregar un reparto generara la venta.

SÓLO LEE. No crea ventas ni toca stock, y es a propósito: facturarlos en lote
sería adivinar dos cosas que el comando no puede saber.

  1. Si la venta ya se cargó a mano en el POS —que es lo que decía la pantalla
     vieja: "el cobro se registra como venta en el POS cuando corresponda"—
     crear otra acá duplicaría la facturación y descontaría el stock dos veces.

  2. Si nadie la cargó, el stock de hoy ya está mal por esa mercadería, pero el
     dueño puede haberlo corregido con un ajuste o con un conteo. Descontar
     ahora se lo restaría de nuevo.

Con la lista en la mano, cada reparto se resuelve desde la pantalla: los que
falten se facturan con el botón "Facturar" de su tarjeta.

    python manage.py repartos_sin_facturar
    python manage.py repartos_sin_facturar --desde 2026-08-01
"""
from django.core.management.base import BaseCommand

from core.models import Comercio
from repartos.models import Reparto


class Command(BaseCommand):
    help = "Lista los repartos entregados que todavía no generaron una venta (sólo lectura)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--desde",
            help="Sólo los repartos con fecha desde este día (YYYY-MM-DD).",
        )
        parser.add_argument(
            "--comercio",
            help="Sólo esta sucursal, por id.",
        )

    def handle(self, *args, **options):
        qs = (
            Reparto.objects.filter(estado="entregado", venta__isnull=True)
            .select_related("comercio")
            .prefetch_related("items__producto")
            .order_by("comercio__nombre", "fecha")
        )
        if options["desde"]:
            qs = qs.filter(fecha__gte=options["desde"])
        if options["comercio"]:
            qs = qs.filter(comercio_id=options["comercio"])

        repartos = list(qs)
        if not repartos:
            self.stdout.write(self.style.SUCCESS(
                "No hay repartos entregados sin facturar. Nada que regularizar."
            ))
            return

        comercio_actual = None
        total_general = 0
        for reparto in repartos:
            if reparto.comercio_id != comercio_actual:
                comercio_actual = reparto.comercio_id
                self.stdout.write("")
                self.stdout.write(self.style.MIGRATE_HEADING(reparto.comercio.nombre))
            total_general += reparto.total
            self.stdout.write(
                f"  {reparto.fecha}  {reparto.cliente_nombre[:28]:<30} "
                f"$ {reparto.total:>12,.2f}  {reparto.id}"
            )
            for item in reparto.items.all():
                nombre = item.producto.nombre if item.producto_id else "(producto borrado)"
                unidad = " bolsas" if item.es_bolsa else ""
                # float antes del :g — sobre un Decimal, "3.000" no se recorta.
                self.stdout.write(f"      {float(item.cantidad):g}{unidad} × {nombre}")

        self.stdout.write("")
        self.stdout.write(self.style.WARNING(
            f"{len(repartos)} reparto(s) entregado(s) sin venta, por $ {total_general:,.2f} en total."
        ))
        self.stdout.write(
            "Ninguno descontó stock ni entró a caja. Revisá uno por uno si la venta ya se\n"
            "cargó a mano en el POS: si NO se cargó, facturalo con el botón \"Facturar\" de\n"
            "su tarjeta en la pantalla de Repartos. Este comando no toca nada."
        )

        # Los pendientes y en camino no necesitan nada: cuando se entreguen van
        # por el camino nuevo. Se cuentan igual para que el dueño sepa que no
        # están en la lista de arriba por un descuido.
        en_curso = Reparto.objects.filter(estado__in=["pendiente", "en_camino"]).count()
        if en_curso:
            self.stdout.write("")
            self.stdout.write(
                f"Aparte hay {en_curso} reparto(s) pendiente(s) o en camino: ésos no hay que\n"
                "tocarlos, van a facturar solos cuando se entreguen."
            )
