from django.contrib import admin

from .models import Position, Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('title', 'level', 'parent_role')
    list_filter = ('level',)
    search_fields = ('title',)


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ('role', 'department', 'employee', 'parent_position')
    list_filter = ('department',)
    search_fields = ('department', 'role__title', 'employee__name')
