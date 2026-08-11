from django.contrib import admin
from .models import Cliente, ClienteAsignacion, ClienteMovimiento, CrmLead

admin.site.register(Cliente)
admin.site.register(ClienteMovimiento)
admin.site.register(ClienteAsignacion)
admin.site.register(CrmLead)
