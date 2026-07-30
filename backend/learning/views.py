from rest_framework.viewsets import ModelViewSet

from config.permissions import DenyExecutive, IsHRAdminOrReadOnly

from .models import LearningResource
from .serializers import LearningResourceSerializer


class LearningResourceViewSet(ModelViewSet):
    queryset = LearningResource.objects.select_related('skill').all()
    serializer_class = LearningResourceSerializer
    permission_classes = [DenyExecutive, IsHRAdminOrReadOnly]
    filterset_fields = ['skill']
