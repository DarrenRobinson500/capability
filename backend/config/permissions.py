"""DRF permission classes implementing the roles/permissions rules from the
project brief (docs/CLAUDE.md, Section 3). Role is a Profile-level tier;
"manager of a team" is computed per-request from the Position tree, not
stored — see get_managed_subtree_ids().
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from orgstructure.services import get_subtree_position_ids
from people.models import Profile


def get_role(user):
    profile = getattr(user, 'profile', None)
    return profile.role if profile else None


def get_employee(user):
    return getattr(user, 'employee', None)


def get_own_position(user):
    employee = get_employee(user)
    return getattr(employee, 'position', None) if employee else None


def get_managed_subtree_ids(user):
    """Position ids this user manages (their own position's reporting
    subtree), if they occupy a Position and hold Manager or HR Admin tier.
    Empty set otherwise — used both here and by the gap-analysis /
    team-matrix endpoints (Phase 4).
    """
    if get_role(user) not in (Profile.Role.MANAGER, Profile.Role.HR_ADMIN):
        return set()
    position = get_own_position(user)
    if position is None:
        return set()
    return get_subtree_position_ids(position.id)


class DenyExecutive(BasePermission):
    """Executives get read-only aggregate/dashboard endpoints only — no
    access to any standard model viewset (Section 3).
    """

    def has_permission(self, request, view):
        return get_role(request.user) != Profile.Role.EXECUTIVE


class IsHRAdminOrReadOnly(BasePermission):
    """HR Admin: full CRUD. Everyone else authenticated: read-only.

    Used for Skill, SkillCategory, ProficiencyScale, Role, Position,
    Certification, LearningResource.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) == Profile.Role.HR_ADMIN


class IsOwnEmployeeOrHRAdminReadOnly(BasePermission):
    """Employee records: HR Admin has full CRUD (org-structure data);
    everyone else gets read-only, except an employee may update their own
    record.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) == Profile.Role.HR_ADMIN

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if get_role(request.user) == Profile.Role.HR_ADMIN:
            return True
        employee = get_employee(request.user)
        return employee is not None and employee.pk == obj.pk


class IsOwnProfileOrHRAdmin(BasePermission):
    """Profile: owner reads/writes their own; HR Admin (who assigns role
    tiers) can read/write any. The viewset scopes list() to just these two
    cases (Phase 3) since object-level permission alone can't filter a list.
    """

    def has_object_permission(self, request, view, obj):
        if get_role(request.user) == Profile.Role.HR_ADMIN:
            return True
        return obj.user_id == request.user.id


class IsOwnSkillRatingOrReadOnly(BasePermission):
    """SkillRating: an Employee may create/update/delete only their own
    rating (self-assessment) — this is deliberately not editable by HR or
    Managers via the standard viewset; Managers endorse via the dedicated
    endorse() action instead (CanEndorseSkillRating). Read access is open to
    any authenticated non-Executive user (Executives are blocked at the
    viewset level via DenyExecutive).
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return get_employee(request.user) is not None

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        employee = get_employee(request.user)
        return employee is not None and employee.pk == obj.employee_id


class CanEndorseSkillRating(BasePermission):
    """The SkillRating.endorse() action: only a Manager whose reporting
    subtree includes the rated employee's Position.
    """

    def has_object_permission(self, request, view, obj):
        if get_role(request.user) != Profile.Role.MANAGER:
            return False
        position = getattr(obj.employee, 'position', None)
        if position is None:
            return False
        return position.id in get_managed_subtree_ids(request.user)


class IsManagerForPositionRequirement(BasePermission):
    """PositionRequirement: a Manager may create/update/delete requirements
    only for positions in their own reporting subtree. HR Admin may also
    manage them, since HR owns Position/org structure broadly (Section 1).
    Read is open to any authenticated non-Executive user.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return get_role(request.user) in (Profile.Role.MANAGER, Profile.Role.HR_ADMIN)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if get_role(request.user) == Profile.Role.HR_ADMIN:
            return True
        return obj.position_id in get_managed_subtree_ids(request.user)


class IsOwnEmployeeCertificationOrHRAdmin(BasePermission):
    """EmployeeCertification is not in HR Admin's Section-3 full-CRUD list,
    but the Certifications Tracker screen (Section 6, #9) is specced as
    "Employee (own) / HR Admin (all)" — so HR Admin manages all records
    (issuing/renewing certs is an HR function) and an employee may read
    (but not fabricate) their own.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) == Profile.Role.HR_ADMIN

    def has_object_permission(self, request, view, obj):
        if get_role(request.user) == Profile.Role.HR_ADMIN:
            return True
        if request.method in SAFE_METHODS:
            employee = get_employee(request.user)
            return employee is not None and employee.pk == obj.employee_id
        return False


class IsManagerOrHRAdminOrReadOnly(BasePermission):
    """Assignment (staffing) has no explicit Section 3 rule. Default: the
    roles who'd staff a project (Manager, HR Admin) can manage it; everyone
    else (incl. Employee) gets read-only, matching the "Capability Search"
    screen's Manager/Staffing Lead audience.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in (Profile.Role.MANAGER, Profile.Role.HR_ADMIN)
