from unittest.mock import patch

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


class MiCuentaTests(APITestCase):
    """Config: "Mi cuenta" — el usuario ve y cambia su propio usuario/contraseña."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Comercio (test)")
        self.user = User.objects.create_user(username="dueno", password="claveVieja123")
        UsuarioComercio.objects.create(user=self.user, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(user=self.user, comercio=self.comercio, nombre_completo="Dueño", rol="Dueño")
        self.client.force_authenticate(user=self.user)

    def test_me_incluye_el_username(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "dueno")

    def test_cambia_el_username(self):
        response = self.client.patch("/api/auth/me/usuario/", {"username": "dueno_nuevo"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "dueno_nuevo")

    def test_rechaza_username_ya_usado_por_otro(self):
        User.objects.create_user(username="ocupado", password="x")
        response = self.client.patch("/api/auth/me/usuario/", {"username": "ocupado"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambia_la_password_con_la_actual_correcta(self):
        response = self.client.post("/api/auth/me/password/", {
            "password_actual": "claveVieja123", "password_nueva": "claveNueva456",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("claveNueva456"))

    def test_rechaza_cambio_de_password_si_la_actual_esta_mal(self):
        response = self.client.post("/api/auth/me/password/", {
            "password_actual": "no_es_esta", "password_nueva": "claveNueva456",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("claveVieja123"))


class WhatsAppEstadoTests(MultiSucursalMixin, APITestCase):
    @patch("core.views.estado_whatsapp")
    def test_devuelve_el_estado_del_bot(self, mock_estado):
        mock_estado.return_value = {"estado": "esperando_qr", "qr": "data:image/png;base64,abc"}
        response = self.client.get("/api/auth/whatsapp/estado/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["estado"], "esperando_qr")

    def test_usuario_sin_rol_dueño_no_puede_ver_el_estado(self):
        cajero = User.objects.create_user(username="cajero_wa@test.com", password="testpass123")
        UsuarioComercio.objects.create(user=cajero, comercio=self.sucursal_1, rol="Cajero")
        Perfil.objects.create(user=cajero, comercio=self.sucursal_1, nombre_completo="Cajero", rol="Cajero")
        self.client.force_authenticate(user=cajero)

        response = self.client.get("/api/auth/whatsapp/estado/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class WhatsAppDesconectarTests(MultiSucursalMixin, APITestCase):
    @patch("core.views.desconectar_whatsapp")
    def test_desconecta_el_bot(self, mock_desconectar):
        mock_desconectar.return_value = {"estado": "conectando", "qr": None}
        response = self.client.post("/api/auth/whatsapp/desconectar/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["estado"], "conectando")
        mock_desconectar.assert_called_once()

    def test_usuario_sin_rol_dueño_no_puede_desconectar(self):
        cajero = User.objects.create_user(username="cajero_wa2@test.com", password="testpass123")
        UsuarioComercio.objects.create(user=cajero, comercio=self.sucursal_1, rol="Cajero")
        Perfil.objects.create(user=cajero, comercio=self.sucursal_1, nombre_completo="Cajero", rol="Cajero")
        self.client.force_authenticate(user=cajero)

        response = self.client.post("/api/auth/whatsapp/desconectar/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ModulosPorEmpleadoTests(APITestCase):
    """El Dueño apaga módulos por empleado (Config > Usuarios)."""

    def setUp(self):
        self.comercio = Comercio.objects.create(nombre="Forrajería (test)")
        self.cajero = User.objects.create_user(username="cajero", password="testpass123")
        self.relacion = UsuarioComercio.objects.create(
            user=self.cajero, comercio=self.comercio, rol="Cajero",
        )
        Perfil.objects.create(user=self.cajero, comercio=self.comercio,
                              nombre_completo="Cajero", rol="Cajero")
        self.client.force_authenticate(user=self.cajero)

    def test_sin_bloqueos_entra(self):
        self.assertEqual(self.client.get("/api/estadisticas/contabilidad/deudas/").status_code, 200)

    def test_modulo_bloqueado_devuelve_403(self):
        self.relacion.modulos_bloqueados = ["/contabilidad"]
        self.relacion.save(update_fields=["modulos_bloqueados"])
        response = self.client.get("/api/estadisticas/contabilidad/deudas/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bloquear_productos_no_rompe_el_buscador_del_pos(self):
        """El POS lee /api/productos/ para vender: apagarle la pantalla de
        productos a un cajero no puede dejarlo sin poder buscar qué cobrar."""
        self.relacion.modulos_bloqueados = ["/productos"]
        self.relacion.save(update_fields=["modulos_bloqueados"])
        self.assertEqual(self.client.get("/api/productos/").status_code, 200)
        self.assertEqual(self.client.get("/api/combos/").status_code, status.HTTP_403_FORBIDDEN)

    def test_el_dueno_nunca_queda_bloqueado(self):
        self.relacion.rol = "Dueño"
        self.relacion.modulos_bloqueados = ["/contabilidad"]
        self.relacion.save(update_fields=["rol", "modulos_bloqueados"])
        self.assertEqual(self.client.get("/api/estadisticas/contabilidad/deudas/").status_code, 200)

    def test_me_informa_los_modulos_para_esconder_el_menu(self):
        self.relacion.modulos_bloqueados = ["/contabilidad", "/estadisticas"]
        self.relacion.save(update_fields=["modulos_bloqueados"])
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.data["modulos_bloqueados"], ["/contabilidad", "/estadisticas"])

    def test_no_acepta_modulos_inventados(self):
        dueno = User.objects.create_user(username="dueno2", password="testpass123")
        UsuarioComercio.objects.create(user=dueno, comercio=self.comercio, rol="Dueño")
        Perfil.objects.create(user=dueno, comercio=self.comercio, nombre_completo="D", rol="Dueño")
        self.client.force_authenticate(user=dueno)
        response = self.client.patch(
            f"/api/auth/usuarios/{self.relacion.id}/", {"modulos_bloqueados": ["/inventado"]}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ColorDeMarcaTests(MultiSucursalMixin, APITestCase):
    """El color que elige el comercio en Config > Apariencia."""

    def _pintar(self, color, sucursal=None):
        return self.client.patch(
            "/api/auth/comercio/", {"color_acento": color}, format="json",
            HTTP_X_COMERCIO_ID=str((sucursal or self.sucursal_1).id),
        )

    def test_se_guarda_y_lo_devuelve_me_para_pintar_el_shell(self):
        response = self._pintar("#ffc21a")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["color_acento"], "#ffc21a")
        # El shell pinta la app con lo que trae /auth/me/: si el color no viaja
        # ahí, al entrar se ve el color viejo hasta abrir Config.
        me = self.client.get("/api/auth/me/", HTTP_X_COMERCIO_ID=str(self.sucursal_1.id))
        self.assertEqual(me.data["comercios"][0]["color_acento"], "#ffc21a")

    def test_vacio_vuelve_al_color_del_tema(self):
        self._pintar("#ffc21a")
        response = self._pintar("")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["color_acento"], "")

    def test_rechaza_lo_que_no_es_un_hex(self):
        for malo in ["rojo", "#12345", "#gggggg", "2f8fff; background:url(x)"]:
            response = self._pintar(malo)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, malo)

    def test_el_color_es_por_sucursal(self):
        """Dos sucursales del mismo dueño pueden tener colores distintos."""
        self._pintar("#ffc21a", self.sucursal_1)
        self._pintar("#22c55e", self.sucursal_2)
        self.sucursal_1.refresh_from_db()
        self.sucursal_2.refresh_from_db()
        self.assertEqual(self.sucursal_1.color_acento, "#ffc21a")
        self.assertEqual(self.sucursal_2.color_acento, "#22c55e")
