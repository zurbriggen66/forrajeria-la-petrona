from django.contrib import admin
from .models import AuditLog, ErrorLog, AlertaLeida, UiEvent, UiHeatmap

admin.site.register(AuditLog)
admin.site.register(ErrorLog)
admin.site.register(AlertaLeida)
admin.site.register(UiEvent)
admin.site.register(UiHeatmap)
