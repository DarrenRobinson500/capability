from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
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


def _position_node(position, children_by_parent):
    return {
        'id': position.id,
        'role_id': position.role_id,
        'role_title': position.role.title,
        'department': position.department,
        'employee_id': position.employee_id,
        'employee_name': position.employee.name if position.employee_id else None,
        'is_vacant': position.employee_id is None,
        'direct_reports': [
            _position_node(child, children_by_parent)
            for child in children_by_parent.get(position.id, [])
        ],
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def org_chart(request):
    """GET /api/org-chart/ — the full Position tree, root(s) down, with
    vacancy flags. Open to everyone (Section 6: "Org Chart — everyone (view)").
    """
    positions = list(Position.objects.select_related('role', 'employee').all())
    children_by_parent = {}
    roots = []
    for position in positions:
        if position.parent_position_id is None:
            roots.append(position)
        else:
            children_by_parent.setdefault(position.parent_position_id, []).append(position)
    return Response([_position_node(root, children_by_parent) for root in roots])
