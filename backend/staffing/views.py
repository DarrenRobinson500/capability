from rest_framework.viewsets import ModelViewSet

from config.permissions import DenyExecutive, IsManagerOrHRAdminOrReadOnly

from .models import Assignment
from .serializers import AssignmentSerializer


class AssignmentViewSet(ModelViewSet):
    queryset = Assignment.objects.prefetch_related('required_skills').all()
    serializer_class = AssignmentSerializer
    permission_classes = [DenyExecutive, IsManagerOrHRAdminOrReadOnly]
