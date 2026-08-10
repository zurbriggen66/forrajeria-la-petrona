"""
Seed de datos FICTICIOS para desarrollo (Fase 0).

Crea: 1 comercio demo, 1 usuario Dueño, 10 categorías, 40 productos variados
(por peso, con oferta, indumentaria con talle/color), 5 clientes, 3 proveedores,
3 cuentas de pago.

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

COMERCIO_DEMO_NOMBRE = "Almacén San Martín (demo)"
DUENO_EMAIL = "dueno@demo.kubo"
DUENO_PASSWORD = "kubo-demo-1234"  # sólo para desarrollo local, nunca en producción

CATEGORIAS = [
    "Almacén", "Bebidas", "Lácteos", "Limpieza", "Kiosco",
    "Heladería", "Indumentaria", "Verdulería", "Panificados", "Congelados",
]

PROVEEDORES = [
    ("Distribuidora Norte SRL", "30-71234567-8"),
    ("Alimentos del Sur SA", "30-70987654-3"),
    ("Textiles Rioplatense", "30-69876543-2"),
]

CLIENTES = [
    ("Juana Pérez", "consumidor_final"),
    ("Carlos Gómez", "consumidor_final"),
    ("Panadería El Trigal", "responsable_inscripto"),
    ("María Fernández", "consumidor_final"),
    ("Kiosco Don Beto", "monotributista"),
]

CUENTAS_PAGO = [
    ("Efectivo", "efectivo", 0),
    ("Tarjeta", "tarjeta", 3.5),
    ("Transferencia", "transferencia", 0),
]

TALLES = ["S", "M", "L", "XL"]
COLORES = ["Negro", "Blanco", "Azul", "Rojo", "Verde"]

# Catálogo maestro GLOBAL (no pertenece a ningún comercio) para autocompletar
# el alta de productos por código de barras. Códigos que NO se solapan con los
# que genera el seed por comercio (7790000xxxxx) para poder probar el alta real.
PRODUCTOS_UNIVERSAL = [
    ("7791234000012", "Coca-Cola 1.5L", "Bebidas", "Coca-Cola"),
    ("7791234000029", "Yerba Mate Playadito 1kg", "Almacén", "Playadito"),
    ("7791234000036", "Leche Entera La Serenísima 1L", "Lácteos", "La Serenísima"),
    ("7791234000043", "Detergente Magistral 750ml", "Limpieza", "Magistral"),
    ("7791234000050", "Alfajor Guaymallén Triple", "Kiosco", "Guaymallén"),
    ("7791234000067", "Helado Frigor Pote 1kg", "Heladería", "Frigor"),
    ("7791234000074", "Remera básica algodón", "Indumentaria", "Genérica"),
    ("7791234000081", "Papa Negra x kg", "Verdulería", "Genérica"),
    ("7791234000098", "Pan Lactal Bimbo", "Panificados", "Bimbo"),
    ("7791234000104", "Hamburguesas Paty x4 congeladas", "Congelados", "Paty"),
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
            rubro="almacen",
        )

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=DUENO_EMAIL,
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

            if categoria.nombre == "Indumentaria":
                kwargs.update(
                    subcategoria="Remeras",
                    modelo_nombre=f"Modelo {i}",
                    talle=rnd.choice(TALLES),
                    color=rnd.choice(COLORES),
                )
            elif categoria.nombre in ("Verdulería", "Heladería"):
                kwargs.update(
                    venta_por_peso=True,
                    unidad_medida="kg",
                    plu_balanza=f"{2000 + i}",
                )

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
            f"Login demo -> usuario: {DUENO_EMAIL} / password: {DUENO_PASSWORD}"
        ))
