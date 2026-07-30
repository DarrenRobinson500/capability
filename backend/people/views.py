from rest_framework.viewsets import ModelViewSet

from config.permissions import DenyExecutive, IsOwnEmployeeOrHRAdminReadOnly, IsOwnProfileOrHRAdmin, get_role
from people.models import Profile

from .models import Employee
from .serializers import EmployeeSerializer, ProfileSerializer


class EmployeeViewSet(ModelViewSet):
    queryset = Employee.objects.select_related('user', 'position').all()
    serializer_class = EmployeeSerializer
    permission_classes = [DenyExecutive, IsOwnEmployeeOrHRAdminReadOnly]


class ProfileViewSet(ModelViewSet):
    """Profiles are created automatically by the post_save signal on User —
    no create/delete via the API, just read/update.
    """

    serializer_class = ProfileSerializer
    permission_classes = [DenyExecutive, IsOwnProfileOrHRAdmin]
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = Profile.objects.select_related('user')
        if get_role(self.request.user) == Profile.Role.HR_ADMIN:
            return qs
        return qs.filter(user=self.request.user)
