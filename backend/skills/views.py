from rest_framework.viewsets import ModelViewSet

from config.permissions import (
    DenyExecutive,
    IsHRAdminOrReadOnly,
    IsManagerForPositionRequirement,
    IsOwnSkillRatingOrReadOnly,
)

from .models import PositionRequirement, ProficiencyScale, Skill, SkillCategory, SkillRating
from .serializers import (
    PositionRequirementSerializer,
    ProficiencyScaleSerializer,
    SkillCategorySerializer,
    SkillRatingSerializer,
    SkillSerializer,
)


class SkillCategoryViewSet(ModelViewSet):
    queryset = SkillCategory.objects.select_related('parent_category').all()
    serializer_class = SkillCategorySerializer
    permission_classes = [DenyExecutive, IsHRAdminOrReadOnly]


class SkillViewSet(ModelViewSet):
    queryset = Skill.objects.select_related('category').all()
    serializer_class = SkillSerializer
    permission_classes = [DenyExecutive, IsHRAdminOrReadOnly]
    filterset_fields = ['category']


class ProficiencyScaleViewSet(ModelViewSet):
    queryset = ProficiencyScale.objects.select_related('skill').all()
    serializer_class = ProficiencyScaleSerializer
    permission_classes = [DenyExecutive, IsHRAdminOrReadOnly]


class SkillRatingViewSet(ModelViewSet):
    queryset = SkillRating.objects.select_related('employee', 'skill').all()
    serializer_class = SkillRatingSerializer
    permission_classes = [DenyExecutive, IsOwnSkillRatingOrReadOnly]
    filterset_fields = ['employee', 'skill', 'source']

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user.employee)


class PositionRequirementViewSet(ModelViewSet):
    queryset = PositionRequirement.objects.select_related('position', 'skill', 'defined_by').all()
    serializer_class = PositionRequirementSerializer
    permission_classes = [DenyExecutive, IsManagerForPositionRequirement]
    filterset_fields = ['position', 'skill', 'required']

    def perform_create(self, serializer):
        serializer.save(defined_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(defined_by=self.request.user)
