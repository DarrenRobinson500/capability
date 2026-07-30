from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from certifications.models import EmployeeCertification
from config.permissions import DenyExecutive, IsHRAdminOrReadOnly, get_role
from people.models import Employee, Profile

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """GET /api/dashboard-summary/ — Executive/HR Admin only.

    Not one of the 5 endpoints enumerated in Section 5, but Section 6's Org
    Capability Dashboard screen (bench strength, vacancy count, cert
    compliance) needs data no other endpoint exposes to Executives — every
    standard model viewset is off-limits to that role via DenyExecutive.
    Smallest sensible addition to close that gap, per Section 9.
    """
    if get_role(request.user) not in (Profile.Role.EXECUTIVE, Profile.Role.HR_ADMIN):
        return Response({'detail': 'Not permitted.'}, status=403)

    positions = list(Position.objects.all())
    by_department = {}
    for position in positions:
        entry = by_department.setdefault(position.department, {'total': 0, 'vacant': 0})
        entry['total'] += 1
        if position.employee_id is None:
            entry['vacant'] += 1

    cert_counts = {choice: 0 for choice in EmployeeCertification.Status.values}
    for record in EmployeeCertification.objects.all():
        cert_counts[record.status] += 1

    return Response({
        'total_positions': len(positions),
        'vacant_positions': sum(1 for p in positions if p.employee_id is None),
        'bench_count': Employee.objects.filter(position__isnull=True).count(),
        'certification_counts': cert_counts,
        'by_department': [{'department': dept, **counts} for dept, counts in by_department.items()],
    })
