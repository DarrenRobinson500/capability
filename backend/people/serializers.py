from rest_framework import serializers

from .models import Employee, Profile


class EmployeeSerializer(serializers.ModelSerializer):
    position_id = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ['id', 'user', 'name', 'location', 'position_id']

    def get_position_id(self, obj):
        position = getattr(obj, 'position', None)
        return position.id if position else None


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Profile
        fields = ['id', 'user', 'username', 'role']
        read_only_fields = ['user']
