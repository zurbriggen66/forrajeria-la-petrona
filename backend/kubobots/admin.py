from django.contrib import admin
from .models import KubobotsCliente, KubobotsMision, KubobotsRecompensa, KubobotsCanje

admin.site.register(KubobotsCliente)
admin.site.register(KubobotsMision)
admin.site.register(KubobotsRecompensa)
admin.site.register(KubobotsCanje)
