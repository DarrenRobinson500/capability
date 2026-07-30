from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from config.permissions import (
    CanEndorseSkillRating,
    DenyExecutive,
    IsHRAdminOrReadOnly,
    IsManagerForPositionRequirement,
    IsOwnSkillRatingOrReadOnly,
    get_managed_subtree_ids,
    get_role,
)
from orgstructure.models import Position
from orgstructure.services import get_subtree_position_ids
from people.models import Profile

from .models import PositionRequirement, ProficiencyScale, Skill, SkillCategory, SkillRating, get_scale_for_skill
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

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanEndorseSkillRating])
    def endorse(self, request, pk=None):
        """POST /api/skill-ratings/<id>/endorse/ — Manager-only, and only for
        employees in the manager's reporting subtree (enforced by
        CanEndorseSkillRating). Sets source to MANAGER_ENDORSED if the rating
        is accepted as-is, or MANAGER_ADJUSTED if the manager supplies a
        different proficiency_level in the request body.
        """
        rating = self.get_object()
        new_level = request.data.get('proficiency_level')
        if new_level and new_level != rating.proficiency_level:
            rating.proficiency_level = new_level
            rating.source = SkillRating.Source.MANAGER_ADJUSTED
        else:
            rating.source = SkillRating.Source.MANAGER_ENDORSED
        rating.save()
        return Response(SkillRatingSerializer(rating).data)


class PositionRequirementViewSet(ModelViewSet):
    queryset = PositionRequirement.objects.select_related('position', 'skill', 'defined_by').all()
    serializer_class = PositionRequirementSerializer
    permission_classes = [DenyExecutive, IsManagerForPositionRequirement]
    filterset_fields = ['position', 'skill', 'required']

    def perform_create(self, serializer):
        serializer.save(defined_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(defined_by=self.request.user)


def _position_gaps(position):
    """Gaps for one Position: for a vacancy, every requirement is an open
    gap; for a filled Position, compare the employee's SkillRatings against
    each requirement's min_proficiency using that skill's ProficiencyScale
    ordering.
    """
    requirements = position.requirements.select_related('skill')

    if position.employee_id is None:
        return [
            {
                'skill_id': req.skill_id,
                'skill_name': req.skill.name,
                'required_level': req.min_proficiency,
                'current_level': None,
                'required': req.required,
                'gap_type': 'vacant_requirement',
            }
            for req in requirements
        ]

    ratings_by_skill = {
        r.skill_id: r for r in SkillRating.objects.filter(employee_id=position.employee_id)
    }
    gaps = []
    for req in requirements:
        rating = ratings_by_skill.get(req.skill_id)
        if rating is None:
            gaps.append({
                'skill_id': req.skill_id,
                'skill_name': req.skill.name,
                'required_level': req.min_proficiency,
                'current_level': None,
                'required': req.required,
                'gap_type': 'missing',
            })
            continue

        scale = get_scale_for_skill(req.skill)
        if scale and req.min_proficiency in scale.levels and rating.proficiency_level in scale.levels:
            if scale.levels.index(rating.proficiency_level) < scale.levels.index(req.min_proficiency):
                gaps.append({
                    'skill_id': req.skill_id,
                    'skill_name': req.skill.name,
                    'required_level': req.min_proficiency,
                    'current_level': rating.proficiency_level,
                    'required': req.required,
                    'gap_type': 'below_minimum',
                })
    return gaps


GAP_ANALYSIS_ROLES = {Profile.Role.MANAGER, Profile.Role.HR_ADMIN, Profile.Role.EXECUTIVE}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gap_analysis(request):
    """GET /api/gap-analysis/?scope=position|team|department|company&id=<id>

    Manager/HR/Executive only (Section 6). A Manager's results are always
    further restricted to their own reporting subtree, regardless of the
    scope/id requested, so they can't probe another team's data by crafting
    a different id.
    """
    role = get_role(request.user)
    if role not in GAP_ANALYSIS_ROLES:
        return Response({'detail': 'Not permitted.'}, status=403)

    scope = request.query_params.get('scope')
    scope_id = request.query_params.get('id')
    if scope not in ('position', 'team', 'department', 'company'):
        return Response({'error': 'scope must be one of position|team|department|company'}, status=400)
    if scope in ('position', 'team') and not scope_id:
        return Response({'error': 'id is required for this scope'}, status=400)

    positions = Position.objects.select_related('role', 'employee')
    if scope == 'position':
        positions = positions.filter(id=scope_id)
    elif scope == 'team':
        positions = positions.filter(id__in=get_subtree_position_ids(int(scope_id)))
    elif scope == 'department':
        if scope_id:
            positions = positions.filter(department=scope_id)

    if role == Profile.Role.MANAGER:
        positions = positions.filter(id__in=get_managed_subtree_ids(request.user))

    result = []
    for position in positions:
        result.append({
            'position_id': position.id,
            'department': position.department,
            'role_title': position.role.title,
            'employee_id': position.employee_id,
            'employee_name': position.employee.name if position.employee_id else None,
            'is_vacant': position.employee_id is None,
            'gaps': _position_gaps(position),
        })

    return Response({'scope': scope, 'positions': result})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def capability_search(request):
    """GET /api/capability-search/?skill=<id>&min_level=<level>

    Manager/Staffing Lead screen (Section 6) — Manager and HR Admin only.
    """
    role = get_role(request.user)
    if role not in (Profile.Role.MANAGER, Profile.Role.HR_ADMIN):
        return Response({'detail': 'Not permitted.'}, status=403)

    skill_id = request.query_params.get('skill')
    if not skill_id:
        return Response({'error': 'skill query param is required'}, status=400)
    try:
        skill = Skill.objects.get(id=skill_id)
    except Skill.DoesNotExist:
        return Response({'error': 'skill not found'}, status=404)

    min_level = request.query_params.get('min_level')
    scale = get_scale_for_skill(skill)
    min_index = None
    if min_level and scale and min_level in scale.levels:
        min_index = scale.levels.index(min_level)

    ratings = SkillRating.objects.filter(skill_id=skill_id).select_related('employee')
    results = []
    for rating in ratings:
        if min_index is not None:
            if rating.proficiency_level not in scale.levels:
                continue
            if scale.levels.index(rating.proficiency_level) < min_index:
                continue
        results.append({
            'employee_id': rating.employee_id,
            'employee_name': rating.employee.name,
            'proficiency_level': rating.proficiency_level,
            'source': rating.source,
        })

    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def position_requirements_overview(request):
    """GET /api/position-requirements-overview/ — HR-only; all
    PositionRequirements grouped by Role, so outliers against a Role's
    typical bar are visible.
    """
    if get_role(request.user) != Profile.Role.HR_ADMIN:
        return Response({'detail': 'Not permitted.'}, status=403)

    requirements = PositionRequirement.objects.select_related('position__role', 'skill')
    by_role = {}
    for req in requirements:
        role = req.position.role
        entry = by_role.setdefault(role.id, {'role_id': role.id, 'role_title': role.title, 'requirements': []})
        entry['requirements'].append({
            'position_id': req.position_id,
            'department': req.position.department,
            'skill_id': req.skill_id,
            'skill_name': req.skill.name,
            'min_proficiency': req.min_proficiency,
            'required': req.required,
        })

    return Response(list(by_role.values()))
