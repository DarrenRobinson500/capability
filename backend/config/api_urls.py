"""API routes, mounted at /api/ by config.urls."""
from django.urls import include, path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from certifications.views import CertificationViewSet, EmployeeCertificationViewSet
from learning.views import LearningResourceViewSet
from orgstructure.views import PositionViewSet, RoleViewSet, org_chart
from people.views import EmployeeViewSet, ProfileViewSet
from skills.views import (
    PositionRequirementViewSet,
    ProficiencyScaleViewSet,
    SkillCategoryViewSet,
    SkillRatingViewSet,
    SkillViewSet,
    capability_search,
    gap_analysis,
    position_requirements_overview,
)
from staffing.views import AssignmentViewSet


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})


router = DefaultRouter()
router.register('roles', RoleViewSet)
router.register('positions', PositionViewSet)
router.register('employees', EmployeeViewSet)
router.register('profiles', ProfileViewSet, basename='profile')
router.register('skill-categories', SkillCategoryViewSet)
router.register('skills', SkillViewSet)
router.register('proficiency-scales', ProficiencyScaleViewSet)
router.register('skill-ratings', SkillRatingViewSet)
router.register('position-requirements', PositionRequirementViewSet)
router.register('certifications', CertificationViewSet)
router.register('employee-certifications', EmployeeCertificationViewSet, basename='employeecertification')
router.register('learning-resources', LearningResourceViewSet)
router.register('assignments', AssignmentViewSet)

urlpatterns = [
    path('health/', health),
    path('org-chart/', org_chart),
    path('gap-analysis/', gap_analysis),
    path('capability-search/', capability_search),
    path('position-requirements-overview/', position_requirements_overview),
    path('', include(router.urls)),
]
