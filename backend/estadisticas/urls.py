from django.urls import path

from .views import RankingsView, RentabilidadView, ResumenView, VerdadDelNegocioView

urlpatterns = [
    path("resumen/", ResumenView.as_view(), name="estadisticas-resumen"),
    path("rankings/", RankingsView.as_view(), name="estadisticas-rankings"),
    path("rentabilidad/", RentabilidadView.as_view(), name="estadisticas-rentabilidad"),
    path("verdad-del-negocio/", VerdadDelNegocioView.as_view(), name="estadisticas-verdad-del-negocio"),
]
