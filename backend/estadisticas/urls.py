from django.urls import path

from .contabilidad import DeudasView, MensualView, ResultadoView
from .views import (
    InicioView,
    PanelView,
    RankingsView,
    RentabilidadView,
    ResumenView,
    VerdadDelNegocioView,
)

urlpatterns = [
    path("inicio/", InicioView.as_view(), name="estadisticas-inicio"),
    path("contabilidad/resultado/", ResultadoView.as_view(), name="contabilidad-resultado"),
    path("contabilidad/mensual/", MensualView.as_view(), name="contabilidad-mensual"),
    path("contabilidad/deudas/", DeudasView.as_view(), name="contabilidad-deudas"),
    path("panel/", PanelView.as_view(), name="estadisticas-panel"),
    path("resumen/", ResumenView.as_view(), name="estadisticas-resumen"),
    path("rankings/", RankingsView.as_view(), name="estadisticas-rankings"),
    path("rentabilidad/", RentabilidadView.as_view(), name="estadisticas-rentabilidad"),
    path("verdad-del-negocio/", VerdadDelNegocioView.as_view(), name="estadisticas-verdad-del-negocio"),
]
