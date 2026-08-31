"""
Seed de datos FICTICIOS para desarrollo (Fase 0).

Crea: 1 comercio demo (forrajería), 1 usuario Dueño, 7 categorías, 40 productos variados
(alimento balanceado, semillas a granel, agroquímicos, ferretería rural, veterinaria,
accesorios para mascotas), 5 clientes, 3 proveedores, 3 cuentas de pago.

Nunca usa datos reales ni el comercio_id observado en el análisis (a6a91020-...).
Idempotente: si el comercio demo ya existe, no vuelve a crear nada.
"""
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from caja.models import CuentaPago
from clientes.models import Cliente
from core.models import Comercio, Perfil, UsuarioComercio
from productos.models import CategoriaProducto, Producto, ProductoUniversal
from proveedores.models import Proveedor

COMERCIO_DEMO_NOMBRE = "Forrajería La Central (demo)"
DUENO_EMAIL = "dueno@demo.kubo"
# Usuario/contraseña de login (campo "Usuario" del login, no el email) — sólo
# para desarrollo local, nunca en producción.
DUENO_USERNAME = "lapetrona"
DUENO_PASSWORD = "gaston2026"

CATEGORIAS = [
    "Alimento Balanceado", "Semillas y Granos", "Agroquímicos y Fertilizantes",
    "Ferretería Rural", "Veterinaria y Sanidad Animal", "Accesorios para Mascotas", "Varios",
]

PROVEEDORES = [
    ("Molinos del Sur SRL", "30-71234567-8"),
    ("AgroInsumos Pampeana SA", "30-70987654-3"),
    ("Distribuidora Rural Norte", "30-69876543-2"),
]

CLIENTES = [
    ("Juana Pérez", "consumidor_final"),
    ("Carlos Gómez", "consumidor_final"),
    ("Estancia La Esperanza", "responsable_inscripto"),
    ("Establecimiento El Ombú", "monotributista"),
    ("Veterinaria San Roque", "responsable_inscripto"),
]

CUENTAS_PAGO = [
    ("Efectivo", "efectivo", 0),
    ("Tarjeta", "tarjeta", 3.5),
    ("Transferencia", "transferencia", 0),
]

# Categoría que se vende suelta por kg (granel), no en bolsa cerrada.
CATEGORIA_GRANEL = "Semillas y Granos"

# Catálogo maestro GLOBAL (no pertenece a ningún comercio) para autocompletar
# el alta de productos por código de barras. Códigos que NO se solapan con los
# que genera el seed por comercio (7790000xxxxx) para poder probar el alta real.
PRODUCTOS_UNIVERSAL = [
    ("7791234000012", "Alimento Balanceado Perro Adulto 25kg", "Alimento Balanceado", "Nutrical"),
    ("7791234000029", "Alimento Balanceado Gato 15kg", "Alimento Balanceado", "Nutrical"),
    ("7791234000036", "Maíz Partido x 25kg", "Alimento Balanceado", "Genérico"),
    ("7791234000043", "Semilla de Alfalfa x kg", "Semillas y Granos", "Genérico"),
    ("7791234000050", "Semilla de Avena x kg", "Semillas y Granos", "Genérico"),
    ("7791234000067", "Glifosato 20L", "Agroquímicos y Fertilizantes", "AgroQuímica"),
    ("7791234000074", "Fertilizante Urea x 50kg", "Agroquímicos y Fertilizantes", "AgroQuímica"),
    ("7791234000081", "Alambre de Púa x Rollo", "Ferretería Rural", "Acindar"),
    ("7791234000098", "Antiparasitario Bovino 500ml", "Veterinaria y Sanidad Animal", "Vetal"),
    ("7791234000104", "Collar Antipulgas Perro", "Accesorios para Mascotas", "Genérico"),
]


class Command(BaseCommand):
    help = "Crea datos ficticios de demo: comercio, usuario Dueño, productos, clientes, proveedores."

    @transaction.atomic
    def handle(self, *args, **options):
        creados_universal = 0
        for codigo, nombre, categoria, marca in PRODUCTOS_UNIVERSAL:
            _, created = ProductoUniversal.objects.get_or_create(
                codigo_barras=codigo,
                defaults={"nombre": nombre, "categoria": categoria, "marca": marca, "verificado": True},
            )
            creados_universal += created
        if creados_universal:
            self.stdout.write(self.style.SUCCESS(
                f"Catálogo universal: {creados_universal} productos nuevos (autocompletado por código de barras)."
            ))

        if Comercio.objects.filter(nombre=COMERCIO_DEMO_NOMBRE).exists():
            self.stdout.write(self.style.WARNING(
                f'Ya existe "{COMERCIO_DEMO_NOMBRE}" — no se vuelve a sembrar. '
                "Borrá el comercio si querés regenerar el seed."
            ))
            return

        rnd = random.Random(42)  # seed fija: datos reproducibles entre corridas

        comercio = Comercio.objects.create(
            nombre=COMERCIO_DEMO_NOMBRE,
            cuit="30-12345678-9",
            direccion="Av. Ficticia 1234, CABA",
            telefono="011-4000-0000",
            email="contacto@demo.kubo",
            rubro="forrajeria",
        )

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=DUENO_USERNAME,
            defaults={"email": DUENO_EMAIL, "is_staff": True, "is_superuser": True},
        )
        if created:
            user.set_password(DUENO_PASSWORD)
            user.save()
        Perfil.objects.update_or_create(
            user=user,
            defaults={"comercio": comercio, "nombre_completo": "Gastón Dueño", "rol": "Dueño"},
        )
        UsuarioComercio.objects.get_or_create(user=user, comercio=comercio, defaults={"rol": "Dueño"})

        categorias = [
            CategoriaProducto.objects.create(comercio=comercio, nombre=nombre, orden=i)
            for i, nombre in enumerate(CATEGORIAS)
        ]

        proveedores = [
            Proveedor.objects.create(comercio=comercio, nombre=nombre, cuit=cuit, activo=True)
            for nombre, cuit in PROVEEDORES
        ]

        for nombre, tipo in CLIENTES:
            Cliente.objects.create(comercio=comercio, nombre=nombre, tipo=tipo)

        for nombre, tipo, comision in CUENTAS_PAGO:
            CuentaPago.objects.create(
                comercio=comercio, nombre=nombre, tipo=tipo, comision_pct=comision
            )

        productos_creados = 0
        for i in range(1, 41):
            categoria = categorias[i % len(categorias)]
            proveedor = proveedores[i % len(proveedores)]
            precio_costo = rnd.uniform(500, 15000)
            precio_venta = round(precio_costo * rnd.uniform(1.3, 1.9), 2)

            kwargs = dict(
                comercio=comercio,
                codigo_barras=f"7790000{i:05d}",
                nombre=f"{categoria.nombre} — Producto {i}",
                categoria=categoria.nombre,
                proveedor=proveedor,
                precio_costo=round(precio_costo, 2),
                precio_venta=precio_venta,
                stock=rnd.randint(0, 200),
                stock_minimo=10,
            )

            if categoria.nombre == CATEGORIA_GRANEL:
                kwargs.update(venta_por_peso=True, unidad_medida="kg")

            if i % 5 == 0:
                kwargs.update(
                    oferta_activa=True,
                    precio_oferta=round(precio_venta * 0.85, 2),
                )

            Producto.objects.create(**kwargs)
            productos_creados += 1

        self.stdout.write(self.style.SUCCESS(
            f'Seed listo: comercio "{comercio.nombre}" ({comercio.id}), '
            f"{len(categorias)} categorías, {productos_creados} productos, "
            f"{len(CLIENTES)} clientes, {len(proveedores)} proveedores, {len(CUENTAS_PAGO)} cuentas de pago."
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Login demo -> usuario: {DUENO_USERNAME} / password: {DUENO_PASSWORD}"
        ))
