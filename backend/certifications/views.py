from rest_framework.viewsets import ModelViewSet

from config.permissions import DenyExecutive, IsHRAdminOrReadOnly, IsOwnEmployeeCertificationOrHRAdmin, get_role
from people.models import Profile

from .models import Certification, EmployeeCertification
from .serializers import CertificationSerializer, EmployeeCertificationSerializer


class CertificationViewSet(ModelViewSet):
    queryset = Certification.objects.select_related('related_skill').all()
    serializer_class = CertificationSerializer
    permission_classes = [DenyExecutive, IsHRAdminOrReadOnly]


class EmployeeCertificationViewSet(ModelViewSet):
    serializer_class = EmployeeCertificationSerializer
    permission_classes = [DenyExecutive, IsOwnEmployeeCertificationOrHRAdmin]
    filterset_fields = ['employee', 'certification']

    def get_queryset(self):
        qs = EmployeeCertification.objects.select_related('employee', 'certification')
        if get_role(self.request.user) == Profile.Role.HR_ADMIN:
            return qs
        employee = getattr(self.request.user, 'employee', None)
        if employee is None:
            return qs.none()
        return qs.filter(employee=employee)
