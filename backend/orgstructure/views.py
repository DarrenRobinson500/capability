from rest_framework.viewsets import ModelViewSet

from config.permissions import DenyExecutive, IsHRAdminOrReadOnly

from .models import Position, Role
from .serializers import PositionSerializer, RoleSerializer


class RoleViewSet(ModelViewSet):
    queryset = Role.objects.select_related('parent_role').all()
    serializer_class = RoleSerializer
    permission_classes = [DenyExecutive, IsHRAdminOrReadOnly]


class PositionViewSet(ModelViewSet):
    queryset = Position.objects.select_related('role', 'employee', 'parent_position').all()
    serializer_class = PositionSerializer
    permission_classes = [DenyExecutive, IsHRAdminOrReadOnly]
