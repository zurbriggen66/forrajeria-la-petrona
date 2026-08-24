from django.test import SimpleTestCase
from django.urls import resolve

from config.urls import spa_index


class SpaCatchAllRoutingTests(SimpleTestCase):
    """El catch-all de config/urls.py reemplaza el try_files de nginx (no hay
    nginx delante en PythonAnywhere). Si el orden de urlpatterns se rompe,
    esto detecta que /api/ o /admin/ empiezan a devolver el index.html."""

    def test_frontend_routes_fall_through_to_spa_index(self):
        self.assertIs(resolve("/pos/").func, spa_index)
        self.assertIs(resolve("/clientes").func, spa_index)
        self.assertIs(resolve("/").func, spa_index)

    def test_api_and_admin_routes_are_not_swallowed(self):
        self.assertIsNot(resolve("/api/auth/token/refresh/").func, spa_index)
        self.assertIsNot(resolve("/admin/").func, spa_index)
