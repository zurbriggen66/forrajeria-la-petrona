from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Comercio, EmpleadoTurno, Perfil, UsuarioComercio

User = get_user_model()


class VendedoresTests(APITestCase):
    def test_lista_solo_perfiles_del_comercio_activo(self):
        comercio = Comercio.objects.create(nombre="Comercio (test)")
        otro_comercio = Comercio.objects.create(nombre="Otro (test)")

        user = User.objects.create_user(username="dueno", password="testpass123")
        UsuarioComercio.objects.create(user=user, comercio=comercio, rol="Dueño")
        Perfil.objects.create(user=user, comercio=comercio, nombre_completo="Gastón Dueño")

        ajeno = User.objects.create_user(username="ajeno", password="testpass123")
        Perfil.objects.create(user=ajeno, comercio=otro_comercio, nombre_completo="Perfil Ajeno")

        self.client.force_authenticate(user=user)
        response = self.client.get("/api/auth/vendedores/")
        self.assertEqual(response.status_code, 200, response.data)
        nombres = [p["nombre_completo"] for p in response.data["results"]]
        self.assertEqual(nombres, ["Gastón Dueño"])


class MultiSucursalMixin:
    """Un usuario Dueño que opera dos sucursales (Comercio), como el caso real
    de un cliente con varias sucursales — Fase 8."""

    def setUp(self):
        self.sucursal_1 = Comercio.objects.create(nombre="Sucursal Centro")
        self.sucursal_2 = Comercio.objects.create(nombre="Sucursal Norte")
        self.user = User.objects.create_user(username="dueno@test.com", email="dueno@test.com", password="testpass123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.sucursal_1, rol="Dueño")
        UsuarioComercio.objects.create(user=self.user, comercio=self.sucursal_2, rol="Dueño")
        Perfil.objects.create(user=self.user, comercio=self.sucursal_1, nombre_completo="Dueño", rol="Dueño")
        self.client.force_authenticate(user=self.user)


class EmpleadoTurnoTests(MultiSucursalMixin, APITestCase):
    def test_turno_se_asocia_a_la_sucursal_activa_por_header(self):
        empleado = Perfil.objects.create(
            user=User.objects.create_user(username="cajera", password="testpass123"),
            comercio=self.sucursal_2, nombre_completo="Cajera Norte",
        )
        payload = {"empleado": str(empleado.id), "fecha": "2026-08-12", "hora_inicio": "09:00", "hora_fin": "17:00"}

        response = self.client.post(
            "/api/auth/empleados-turnos/", payload, format="json",
            HTTP_X_COMERCIO_ID=str(self.sucursal_2.id),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        turno = EmpleadoTurno.objects.get()
        self.assertEqual(turno.comercio, self.sucursal_2)

    def test_no_ve_turnos_de_otra_sucursal(self):
        EmpleadoTurno.objects.create(comercio=self.sucursal_1, fecha="2026-08-12")
        EmpleadoTurno.objects.create(comercio=self.sucursal_2, fecha="2026-08-12")

        response = self.client.get("/api/auth/empleados-turnos/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(response.data["count"], 1)


class ComercioActivoTests(MultiSucursalMixin, APITestCase):
    def test_actualiza_datos_de_la_sucursal_activa(self):
        response = self.client.patch(
            "/api/auth/comercio/", {"direccion": "Av. Siempre Viva 742"}, format="json",
            HTTP_X_COMERCIO_ID=str(self.sucursal_2.id),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.sucursal_2.refresh_from_db()
        self.assertEqual(self.sucursal_2.direccion, "Av. Siempre Viva 742")
        self.sucursal_1.refresh_from_db()
        self.assertEqual(self.sucursal_1.direccion, "")


class UsuarioComercioTests(MultiSucursalMixin, APITestCase):
    def test_dueño_invita_usuario_nuevo_a_la_sucursal_activa(self):
        payload = {"email": "nueva@test.com", "nombre_completo": "Cajera Nueva", "rol": "Cajero", "password": "temporal123"}

        response = self.client.post(
            "/api/auth/usuarios/", payload, format="json", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        nuevo_user = User.objects.get(email="nueva@test.com")
        self.assertTrue(UsuarioComercio.objects.filter(user=nuevo_user, comercio=self.sucursal_1, rol="Cajero").exists())
        self.assertTrue(Perfil.objects.filter(user=nuevo_user, nombre_completo="Cajera Nueva").exists())

    def test_usuario_sin_rol_dueño_no_puede_gestionar_usuarios(self):
        cajero = User.objects.create_user(username="cajero@test.com", password="testpass123")
        UsuarioComercio.objects.create(user=cajero, comercio=self.sucursal_1, rol="Cajero")
        Perfil.objects.create(user=cajero, comercio=self.sucursal_1, nombre_completo="Cajero", rol="Cajero")
        self.client.force_authenticate(user=cajero)

        response = self.client.get("/api/auth/usuarios/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RespaldoTests(MultiSucursalMixin, APITestCase):
    def test_descarga_respaldo_de_la_sucursal_activa(self):
        response = self.client.get("/api/auth/respaldo/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertEqual(response.json()["comercio"], "Sucursal Centro")
