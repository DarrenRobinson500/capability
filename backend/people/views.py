from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
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


def _serialize_current_user(user):
    profile = getattr(user, 'profile', None)
    employee = getattr(user, 'employee', None)
    position = getattr(employee, 'position', None) if employee else None
    return {
        'id': user.id,
        'username': user.username,
        'role': profile.role if profile else None,
        'employee_id': employee.id if employee else None,
        'employee_name': employee.name if employee else None,
        'position_id': position.id if position else None,
        'is_staff': user.is_staff,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def csrf(request):
    """GET /api/auth/csrf/ — call once on app load so the csrftoken cookie is
    set; the frontend then reads it and sends X-CSRFToken on every unsafe
    request (session auth needs CSRF, unlike a bearer token scheme).
    """
    get_token(request)
    return Response({'detail': 'CSRF cookie set'})


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '')
    password = request.data.get('password', '')
    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'detail': 'Invalid credentials.'}, status=401)
    login(request, user)
    return Response(_serialize_current_user(user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(_serialize_current_user(request.user))
