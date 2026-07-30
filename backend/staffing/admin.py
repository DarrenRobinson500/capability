from django.contrib import admin

from .models import Assignment


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date')
    filter_horizontal = ('required_skills',)
    search_fields = ('name',)
