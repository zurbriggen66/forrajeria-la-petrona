from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    FacturaProveedorViewSet,
    PedidoCatalogoViewSet,
    PedidoManualViewSet,
    PedidosSugeridosView,
    ProveedorViewSet,
)

router = DefaultRouter()
router.register("proveedores", ProveedorViewSet, basename="proveedor")
router.register("proveedores/facturas", FacturaProveedorViewSet, basename="factura-proveedor")
router.register("pedidos/manuales", PedidoManualViewSet, basename="pedido-manual")
router.register("pedidos/catalogo", PedidoCatalogoViewSet, basename="pedido-catalogo")

urlpatterns = [
    path("pedidos/sugeridos/", PedidosSugeridosView.as_view(), name="pedidos-sugeridos"),
] + router.urls
