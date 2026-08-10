from django.contrib import admin
from .models import Comercio, Perfil, UsuarioComercio, ComercioDispositivo, EmpleadoTurno

admin.site.register(Comercio)
admin.site.register(Perfil)
admin.site.register(UsuarioComercio)
admin.site.register(ComercioDispositivo)
admin.site.register(EmpleadoTurno)
