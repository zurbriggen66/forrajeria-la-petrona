from rest_framework.routers import DefaultRouter

from .views import (
    AjustePrecioViewSet,
    CategoriaProductoViewSet,
    ComboViewSet,
    ListaPrecioViewSet,
    ProductoUniversalViewSet,
    ProductoViewSet,
    SubcategoriaProductoViewSet,
)

router = DefaultRouter()
router.register("productos-universal", ProductoUniversalViewSet, basename="producto-universal")
router.register("categorias-productos", CategoriaProductoViewSet, basename="categoria-producto")
router.register("subcategorias-productos", SubcategoriaProductoViewSet, basename="subcategoria-producto")
router.register("combos", ComboViewSet, basename="combo")
router.register("listas-precios", ListaPrecioViewSet, basename="lista-precio")
router.register("ajustes-precios", AjustePrecioViewSet, basename="ajuste-precio")
router.register("productos", ProductoViewSet, basename="producto")

urlpatterns = router.urls
