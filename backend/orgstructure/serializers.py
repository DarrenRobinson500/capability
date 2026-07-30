from rest_framework import serializers

from config.serializers import ModelCleanOnSaveMixin

from .models import Position, Role


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'title', 'level', 'parent_role', 'description']


class PositionSerializer(ModelCleanOnSaveMixin, serializers.ModelSerializer):
    role_title = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    is_vacant = serializers.SerializerMethodField()

    class Meta:
        model = Position
        fields = [
            'id', 'role', 'role_title', 'parent_position', 'department',
            'employee', 'employee_name', 'is_vacant',
        ]

    def get_role_title(self, obj):
        return obj.role.title

    def get_employee_name(self, obj):
        return obj.employee.name if obj.employee_id else None

    def get_is_vacant(self, obj):
        return obj.employee_id is None
