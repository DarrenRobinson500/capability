from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
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
@authentication_classes([])
@permission_classes([AllowAny])
def logout_view(request):
    """No SessionAuthentication here on purpose: DRF's SessionAuthentication
    enforces CSRF on every authenticated request regardless of the view's
    own permission_classes, so a stale/rotated CSRF token would otherwise
    make logout itself return 403 — the one request that should never get
    a user stuck. request.session is still the real Django session (DRF's
    Request proxies it straight through), so logout(request) flushes it
    correctly either way. Worst case of skipping the check here is a
    CSRF-forced logout, not a security escalation.
    """
    logout(request)
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(_serialize_current_user(request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user_view(request):
    """POST /api/users/create/ — HR Admin only. Creates a Django User (with
    its auto-created Profile then given the requested role) and, if a name
    is supplied, an Employee record linked to it in one step. There's no
    self-registration anywhere in this app — this is the only way to
    provision a new login, matching Section 1's "HR owns ... org structure".
    """
    if get_role(request.user) != Profile.Role.HR_ADMIN:
        return Response({'detail': 'Not permitted.'}, status=403)

    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    role = request.data.get('role', Profile.Role.EMPLOYEE)
    employee_name = request.data.get('employee_name', '').strip()
    location = request.data.get('location', '')

    if not username or not password:
        return Response({'detail': 'username and password are required.'}, status=400)
    if role not in Profile.Role.values:
        return Response({'detail': f'role must be one of {Profile.Role.values}.'}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({'detail': 'That username is already taken.'}, status=400)

    new_user = User.objects.create_user(username=username, password=password)
    new_user.profile.role = role
    new_user.profile.save()

    employee = None
    if employee_name:
        employee = Employee.objects.create(user=new_user, name=employee_name, location=location)

    return Response(
        {
            'id': new_user.id,
            'username': new_user.username,
            'role': new_user.profile.role,
            'employee_id': employee.id if employee else None,
            'employee_name': employee.name if employee else None,
        },
        status=201,
    )
