from rest_framework.routers import DefaultRouter

from .views import ClienteAsignacionViewSet, ClienteViewSet, CrmLeadViewSet

router = DefaultRouter()
router.register("clientes", ClienteViewSet, basename="cliente")
router.register("clientes-asignaciones", ClienteAsignacionViewSet, basename="cliente-asignacion")
router.register("crm/leads", CrmLeadViewSet, basename="crm-lead")

urlpatterns = router.urls
