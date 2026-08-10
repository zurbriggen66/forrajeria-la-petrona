from django.contrib import admin
from .models import Cliente, ClienteAsignacion, CrmLead

admin.site.register(Cliente)
admin.site.register(ClienteAsignacion)
admin.site.register(CrmLead)
