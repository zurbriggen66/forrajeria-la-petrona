from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from caja.models import CajaSesion
from core.models import Comercio, Perfil, UsuarioComercio
from telemetria.models import ErrorLog
from ventas.models import Venta

User = get_user_model()


class ComercioAdminTests(APITestCase):
    def setUp(self):
        self.sucursal_1 = Comercio.objects.create(nombre="Sucursal Centro")
        self.sucursal_2 = Comercio.objects.create(nombre="Sucursal Norte")
        self.ajena = Comercio.objects.create(nombre="No operada por este usuario")

        self.user = User.objects.create_user(username="dueno@test.com", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.sucursal_1, rol="Dueño")
        UsuarioComercio.objects.create(user=self.user, comercio=self.sucursal_2, rol="Dueño")
        Perfil.objects.create(user=self.user, comercio=self.sucursal_1, nombre_completo="Dueño", rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def test_lista_solo_las_sucursales_que_opera_con_kpis_del_dia(self):
        Venta.objects.create(comercio=self.sucursal_1, total=Decimal("1500"))
        Venta.objects.create(comercio=self.sucursal_1, total=Decimal("500"), anulada=True)
        CajaSesion.objects.create(comercio=self.sucursal_2, estado="abierta", monto_apertura=Decimal("0"))

        response = self.client.get("/api/admin/comercios/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        por_nombre = {c["nombre"]: c for c in response.data}
        self.assertEqual(set(por_nombre), {"Sucursal Centro", "Sucursal Norte"})
        self.assertEqual(por_nombre["Sucursal Centro"]["ventas_hoy"], "1500.00")
        self.assertFalse(por_nombre["Sucursal Centro"]["caja_abierta"])
        self.assertTrue(por_nombre["Sucursal Norte"]["caja_abierta"])

    def test_alta_de_sucursal_deja_al_usuario_como_dueño(self):
        response = self.client.post("/api/admin/comercios/", {"nombre": "Sucursal Sur"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        nueva = Comercio.objects.get(nombre="Sucursal Sur")
        self.assertTrue(UsuarioComercio.objects.filter(user=self.user, comercio=nueva, rol="Dueño").exists())

    def test_usuario_sin_rol_dueño_no_accede(self):
        cajero = User.objects.create_user(username="cajero@test.com", password="testpass123")
        UsuarioComercio.objects.create(user=cajero, comercio=self.sucursal_1, rol="Cajero")
        Perfil.objects.create(user=cajero, comercio=self.sucursal_1, nombre_completo="Cajero", rol="Cajero")
        self.client.force_authenticate(user=cajero)

        response = self.client.get("/api/admin/comercios/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ErrorLogTests(APITestCase):
    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.otro_comercio = Comercio.objects.create(nombre="Otro (test)")
        self.user = User.objects.create_user(username="dueno@test.com", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Dueño", rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def test_lista_solo_errores_del_comercio_activo(self):
        ErrorLog.objects.create(comercio=self.comercio, tipo="js", mensaje="TypeError")
        ErrorLog.objects.create(comercio=self.otro_comercio, tipo="js", mensaje="Ajeno")

        response = self.client.get("/api/admin/error-logs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["mensaje"], "TypeError")
