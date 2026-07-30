from django.contrib.auth.models import User
from django.test import Client, TestCase

from orgstructure.models import Position, Role
from people.models import Employee, Profile

from .models import PositionRequirement, ProficiencyScale, Skill, SkillCategory


def make_manager(username, position):
    user = User.objects.create_user(username, password='x')
    user.profile.role = Profile.Role.MANAGER
    user.profile.save()
    employee = Employee.objects.create(user=user, name=username)
    position.employee = employee
    position.save()
    return user, employee


class ManagerSubtreePermissionBoundaryTests(TestCase):
    """A Manager may create/update PositionRequirements only for positions in
    their own reporting subtree — not for another team's positions, even
    though they can read them.
    """

    def setUp(self):
        role = Role.objects.create(title='Engineer', level=1)
        self.skill = Skill.objects.create(name='Python', category=SkillCategory.objects.create(name='Tech'))
        ProficiencyScale.objects.create(skill=None, levels=['Novice', 'Practitioner', 'Advanced', 'Expert'])

        self.team_a_manager_position = Position.objects.create(role=role, department='Eng')
        self.manager_a, _ = make_manager('manager_a', self.team_a_manager_position)
        self.team_a_report_position = Position.objects.create(
            role=role, department='Eng', parent_position=self.team_a_manager_position
        )

        self.team_b_manager_position = Position.objects.create(role=role, department='Eng')
        self.manager_b, _ = make_manager('manager_b', self.team_b_manager_position)
        self.team_b_report_position = Position.objects.create(
            role=role, department='Eng', parent_position=self.team_b_manager_position
        )

        self.client_a = Client()
        self.client_a.force_login(self.manager_a)

    def test_manager_can_set_requirement_for_own_subtree(self):
        response = self.client_a.post(
            '/api/position-requirements/',
            {'position': self.team_a_report_position.id, 'skill': self.skill.id, 'min_proficiency': 'Advanced'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)

    def test_manager_cannot_set_requirement_outside_subtree(self):
        response = self.client_a.post(
            '/api/position-requirements/',
            {'position': self.team_b_report_position.id, 'skill': self.skill.id, 'min_proficiency': 'Advanced'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_manager_cannot_update_requirement_outside_subtree(self):
        requirement = PositionRequirement.objects.create(
            position=self.team_b_report_position, skill=self.skill, min_proficiency='Advanced'
        )
        response = self.client_a.patch(
            f'/api/position-requirements/{requirement.id}/',
            {'min_proficiency': 'Expert'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_manager_can_read_requirements_outside_subtree(self):
        PositionRequirement.objects.create(
            position=self.team_b_report_position, skill=self.skill, min_proficiency='Advanced'
        )
        response = self.client_a.get('/api/position-requirements/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)


class GapAnalysisCalculationTests(TestCase):
    def setUp(self):
        role = Role.objects.create(title='Engineer', level=1)
        category = SkillCategory.objects.create(name='Tech')
        self.python = Skill.objects.create(name='Python', category=category)
        self.git = Skill.objects.create(name='Git', category=category)
        ProficiencyScale.objects.create(skill=None, levels=['Novice', 'Practitioner', 'Advanced', 'Expert'])

        self.manager_position = Position.objects.create(role=role, department='Eng')
        self.manager, _ = make_manager('gap_manager', self.manager_position)

        self.filled_position = Position.objects.create(
            role=role, department='Eng', parent_position=self.manager_position
        )
        _, self.report_employee = make_manager('gap_report', self.filled_position)
        # make_manager sets Profile.role=MANAGER as a side effect; downgrade
        # since this employee is an individual contributor for this test.
        self.report_employee.user.profile.role = Profile.Role.EMPLOYEE
        self.report_employee.user.profile.save()

        self.vacant_position = Position.objects.create(
            role=role, department='Eng', parent_position=self.manager_position
        )

        PositionRequirement.objects.create(position=self.filled_position, skill=self.python, min_proficiency='Advanced')
        PositionRequirement.objects.create(position=self.filled_position, skill=self.git, min_proficiency='Practitioner')
        PositionRequirement.objects.create(position=self.vacant_position, skill=self.python, min_proficiency='Expert')

        # Below the Advanced requirement -> a below_minimum gap.
        from .models import SkillRating
        SkillRating.objects.create(employee=self.report_employee, skill=self.python, proficiency_level='Novice')
        # Git has no rating at all -> a missing gap.

        self.client = Client()
        self.client.force_login(self.manager)

    def test_gap_types_for_team_scope(self):
        response = self.client.get(f'/api/gap-analysis/?scope=team&id={self.manager_position.id}')
        self.assertEqual(response.status_code, 200)
        data = response.json()

        by_position = {p['position_id']: p for p in data['positions']}

        filled = by_position[self.filled_position.id]
        gap_types = {g['skill_id']: g['gap_type'] for g in filled['gaps']}
        self.assertEqual(gap_types[self.python.id], 'below_minimum')
        self.assertEqual(gap_types[self.git.id], 'missing')

        vacant = by_position[self.vacant_position.id]
        self.assertTrue(vacant['is_vacant'])
        self.assertEqual(len(vacant['gaps']), 1)
        self.assertEqual(vacant['gaps'][0]['gap_type'], 'vacant_requirement')

        manager_row = by_position[self.manager_position.id]
        self.assertEqual(manager_row['gaps'], [])

    def test_gap_analysis_blocked_for_plain_employee(self):
        employee_user = User.objects.create_user('plain_gap_viewer', password='x')
        client = Client()
        client.force_login(employee_user)
        response = client.get('/api/gap-analysis/?scope=company')
        self.assertEqual(response.status_code, 403)
