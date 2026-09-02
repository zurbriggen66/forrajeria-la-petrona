"""Archiva el registro de ediciones y borrados de cuentas corrientes.

La pantalla muestra la última semana, que es la ventana con la que se trabaja.
Este comando saca de la vista lo más viejo SIN perderlo: primero lo escribe a un
archivo JSON con fecha, y sólo borra de la base si se lo pide explícitamente con
--borrar.

Por qué no borra solo: un registro de auditoría que se borra deja de ser un
registro. Si dentro de tres meses un cliente discute un pago que alguien le
editó, lo único que hay para mostrarle es esta tabla. El default entonces es
exportar y NO borrar; borrar es una decisión que alguien tiene que tomar a mano,
con el archivo ya guardado.

    python manage.py clientes_auditoria_archivar                 # exporta lo de más de 7 días
    python manage.py clientes_auditoria_archivar --dias 30       # otra ventana
    python manage.py clientes_auditoria_archivar --borrar        # exporta Y borra de la base
    python manage.py clientes_auditoria_archivar --destino /ruta # dónde guardar
"""
import json
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from clientes.models import MovimientoAuditoria


class Command(BaseCommand):
    help = "Exporta a JSON el registro de auditoría más viejo que N días (y opcionalmente lo borra)."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=7, help="Qué tan viejo tiene que ser (default 7).")
        parser.add_argument(
            "--destino",
            help="Carpeta donde escribir el archivo (default: <proyecto>/auditoria_archivada).",
        )
        parser.add_argument(
            "--borrar",
            action="store_true",
            help="Borrar de la base lo exportado. Sin esto sólo se exporta.",
        )

    def handle(self, *args, **options):
        corte = timezone.now() - timedelta(days=options["dias"])
        qs = (
            MovimientoAuditoria.objects.filter(created_at__lt=corte)
            .select_related("comercio", "hecho_por")
            .order_by("created_at")
        )

        filas = [
            {
                "id": str(r.id),
                "comercio": r.comercio.nombre,
                "fecha": r.created_at.isoformat(),
                "accion": r.accion,
                "motivo": r.motivo,
                "cliente": r.cliente_nombre,
                "cliente_id": str(r.cliente_id) if r.cliente_id else None,
                "movimiento_id": str(r.movimiento_id),
                "tipo": r.tipo,
                "monto_anterior": str(r.monto_anterior),
                "monto_nuevo": None if r.monto_nuevo is None else str(r.monto_nuevo),
                "referencia_anterior": r.referencia_anterior,
                "referencia_nueva": r.referencia_nueva,
                "medio_pago_anterior": r.medio_pago_anterior,
                "medio_pago_nuevo": r.medio_pago_nuevo,
                "saldo_anterior": str(r.saldo_anterior),
                "saldo_nuevo": str(r.saldo_nuevo),
                "hecho_por": r.hecho_por.nombre_completo if r.hecho_por_id else None,
            }
            for r in qs
        ]

        if not filas:
            self.stdout.write(self.style.SUCCESS(
                f"No hay registros de más de {options['dias']} días. Nada para archivar."
            ))
            return

        destino = Path(options["destino"] or (Path(settings.BASE_DIR) / "auditoria_archivada"))
        destino.mkdir(parents=True, exist_ok=True)
        archivo = destino / f"cuentas-corrientes-{timezone.now():%Y%m%d-%H%M%S}.json"
        archivo.write_text(json.dumps(filas, ensure_ascii=False, indent=2), encoding="utf-8")

        self.stdout.write(self.style.SUCCESS(
            f"{len(filas)} registro(s) exportado(s) a {archivo}"
        ))

        if not options["borrar"]:
            self.stdout.write(
                "No se borró nada de la base. Guardá ese archivo donde no se pierda\n"
                "(no en el servidor: un redeploy se lo puede llevar) y recién entonces,\n"
                "si querés vaciar la tabla, volvé a correr esto con --borrar."
            )
            return

        # Se borra por id y no por el filtro de fecha otra vez: entre el export y
        # el borrado pudo entrar un registro nuevo, y no estaría en el archivo.
        borrados, _ = MovimientoAuditoria.objects.filter(id__in=[f["id"] for f in filas]).delete()
        self.stdout.write(self.style.WARNING(
            f"{borrados} registro(s) borrado(s) de la base. La única copia ahora es {archivo.name}."
        ))
