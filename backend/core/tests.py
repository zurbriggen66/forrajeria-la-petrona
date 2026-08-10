from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Comercio, Perfil, UsuarioComercio

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
