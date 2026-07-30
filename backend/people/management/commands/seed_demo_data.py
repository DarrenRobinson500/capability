import datetime

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from certifications.models import Certification, EmployeeCertification
from learning.models import LearningResource
from orgstructure.models import Position, Role
from people.models import Employee, Profile
from skills.models import PositionRequirement, ProficiencyScale, Skill, SkillCategory, SkillRating

DEMO_PASSWORD = 'demopass123'


class Command(BaseCommand):
    help = 'Seed the database with demo data for local development/demonstration. Run once on a fresh DB.'

    def handle(self, *args, **options):
        if Position.objects.exists():
            self.stdout.write(self.style.WARNING(
                'Positions already exist — refusing to seed a second time (this command assumes a fresh DB).'
            ))
            return

        skills = self._seed_skills()
        roles = self._seed_roles()
        positions, employees = self._seed_org_tree(roles)
        self._seed_position_requirements(positions, skills)
        self._seed_skill_ratings(employees, skills)
        self._seed_certifications(employees, skills)
        self._seed_learning_resources(skills)

        self.stdout.write(self.style.SUCCESS(
            f'Seed complete: {len(roles)} roles, {len(positions)} positions '
            f'({sum(1 for p in positions.values() if p.employee_id is None)} vacant), '
            f'{len(employees)} employees. All demo logins use password "{DEMO_PASSWORD}".'
        ))

    # -- Skills -----------------------------------------------------------

    def _seed_skills(self):
        categories = {
            'Programming Languages': ['Python', 'JavaScript', 'Go', 'TypeScript'],
            'Engineering Practices': ['Git', 'System Design', 'Code Review', 'Testing'],
            'Soft Skills': ['Communication', 'Leadership', 'Mentoring', 'Negotiation'],
            'Sales & CRM': ['CRM Tools', 'Prospecting', 'Objection Handling', 'Contract Negotiation'],
            'Data & Analytics': ['SQL', 'Excel', 'Data Analysis', 'Data Visualization'],
        }
        skills = {}
        for category_name, skill_names in categories.items():
            category = SkillCategory.objects.create(name=category_name)
            for skill_name in skill_names:
                skills[skill_name] = Skill.objects.create(name=skill_name, category=category)

        ProficiencyScale.objects.create(
            skill=None, levels=['Novice', 'Practitioner', 'Advanced', 'Expert']
        )
        return skills

    # -- Roles --------------------------------------------------------------

    def _seed_roles(self):
        roles = {}
        roles['Engineer I'] = Role.objects.create(title='Engineer I', level=1)
        roles['Engineer II'] = Role.objects.create(
            title='Engineer II', level=2, parent_role=roles['Engineer I']
        )
        roles['Senior Engineer'] = Role.objects.create(
            title='Senior Engineer', level=3, parent_role=roles['Engineer II']
        )
        roles['Engineering Manager'] = Role.objects.create(
            title='Engineering Manager', level=4, parent_role=roles['Senior Engineer']
        )
        roles['Sales Rep'] = Role.objects.create(title='Sales Rep', level=1)
        roles['Senior Sales Rep'] = Role.objects.create(
            title='Senior Sales Rep', level=2, parent_role=roles['Sales Rep']
        )
        return roles

    # -- Org tree -------------------------------------------------------------

    def _make_person(self, username, name, role_tier):
        user = User.objects.create_user(username=username, password=DEMO_PASSWORD)
        user.profile.role = role_tier
        user.profile.save()
        return Employee.objects.create(user=user, name=name)

    def _seed_org_tree(self, roles):
        positions = {}
        employees = {}

        def make_position(key, role_key, department, parent_key=None, employee=None):
            positions[key] = Position.objects.create(
                role=roles[role_key],
                department=department,
                parent_position=positions[parent_key] if parent_key else None,
                employee=employee,
            )

        priya = self._make_person('priya', 'Priya Patel', Profile.Role.MANAGER)
        make_position('eng_mgr', 'Engineering Manager', 'Engineering', employee=priya)

        sam = self._make_person('sam', 'Sam Chen', Profile.Role.MANAGER)
        make_position('senior_a', 'Senior Engineer', 'Engineering', 'eng_mgr', employee=sam)

        jordan = self._make_person('jordan', 'Jordan Lee', Profile.Role.MANAGER)
        make_position('eng2_a1', 'Engineer II', 'Engineering', 'senior_a', employee=jordan)
        casey = self._make_person('casey', 'Casey Kim', Profile.Role.EMPLOYEE)
        make_position('eng1_a1a', 'Engineer I', 'Engineering', 'eng2_a1', employee=casey)
        make_position('eng1_a1b', 'Engineer I', 'Engineering', 'eng2_a1')  # vacant

        morgan = self._make_person('morgan', 'Morgan Davis', Profile.Role.MANAGER)
        make_position('eng2_a2', 'Engineer II', 'Engineering', 'senior_a', employee=morgan)
        riley = self._make_person('riley', 'Riley Brooks', Profile.Role.EMPLOYEE)
        make_position('eng1_a2a', 'Engineer I', 'Engineering', 'eng2_a2', employee=riley)

        alex = self._make_person('alex', 'Alex Nguyen', Profile.Role.MANAGER)
        make_position('senior_b', 'Senior Engineer', 'Engineering', 'eng_mgr', employee=alex)

        taylor = self._make_person('taylor', 'Taylor Green', Profile.Role.MANAGER)
        make_position('eng2_b1', 'Engineer II', 'Engineering', 'senior_b', employee=taylor)
        jamie = self._make_person('jamie', 'Jamie White', Profile.Role.EMPLOYEE)
        make_position('eng1_b1a', 'Engineer I', 'Engineering', 'eng2_b1', employee=jamie)
        make_position('eng1_b1b', 'Engineer I', 'Engineering', 'eng2_b1')  # vacant

        drew = self._make_person('drew', 'Drew Foster', Profile.Role.MANAGER)
        make_position('sales_lead', 'Senior Sales Rep', 'Sales', employee=drew)

        skyler = self._make_person('skyler', 'Skyler Adams', Profile.Role.EMPLOYEE)
        make_position('sales_s1', 'Sales Rep', 'Sales', 'sales_lead', employee=skyler)
        make_position('sales_s2', 'Sales Rep', 'Sales', 'sales_lead')  # vacant
        quinn = self._make_person('quinn', 'Quinn Torres', Profile.Role.EMPLOYEE)
        make_position('sales_s3', 'Sales Rep', 'Sales', 'sales_lead', employee=quinn)

        # HR Admin and Executive — not part of the reporting line, on the bench.
        harper = self._make_person('harper', 'Harper Wilson', Profile.Role.HR_ADMIN)
        harper.user.is_staff = True
        harper.user.is_superuser = True
        harper.user.save()

        reese = self._make_person('reese', 'Reese Morgan', Profile.Role.EXECUTIVE)

        employees.update({
            'priya': priya, 'sam': sam, 'jordan': jordan, 'casey': casey, 'morgan': morgan,
            'riley': riley, 'alex': alex, 'taylor': taylor, 'jamie': jamie, 'drew': drew,
            'skyler': skyler, 'quinn': quinn, 'harper': harper, 'reese': reese,
        })
        return positions, employees

    # -- Position requirements ----------------------------------------------

    def _seed_position_requirements(self, positions, skills):
        def require(position_key, skill_name, min_level):
            PositionRequirement.objects.create(
                position=positions[position_key],
                skill=skills[skill_name],
                min_proficiency=min_level,
            )

        for key in ('eng1_a1a', 'eng1_a1b', 'eng1_a2a', 'eng1_b1a', 'eng1_b1b'):
            require(key, 'Python', 'Practitioner')
            require(key, 'Git', 'Practitioner')

        for key in ('eng2_a1', 'eng2_a2', 'eng2_b1'):
            require(key, 'Python', 'Advanced')
            require(key, 'Git', 'Advanced')
            require(key, 'Code Review', 'Practitioner')

        for key in ('senior_a', 'senior_b'):
            require(key, 'Python', 'Expert')
            require(key, 'System Design', 'Advanced')
            require(key, 'Mentoring', 'Practitioner')
            require(key, 'Code Review', 'Advanced')

        require('eng_mgr', 'Leadership', 'Advanced')
        require('eng_mgr', 'System Design', 'Advanced')
        require('eng_mgr', 'Communication', 'Advanced')

        for key in ('sales_s1', 'sales_s2', 'sales_s3'):
            require(key, 'CRM Tools', 'Practitioner')
            require(key, 'Prospecting', 'Practitioner')

        require('sales_lead', 'CRM Tools', 'Advanced')
        require('sales_lead', 'Negotiation', 'Advanced')
        require('sales_lead', 'Contract Negotiation', 'Practitioner')

    # -- Skill ratings --------------------------------------------------------

    def _seed_skill_ratings(self, employees, skills):
        def rate(username, skill_name, level, source):
            SkillRating.objects.create(
                employee=employees[username],
                skill=skills[skill_name],
                proficiency_level=level,
                source=source,
            )

        SELF = SkillRating.Source.SELF
        ENDORSED = SkillRating.Source.MANAGER_ENDORSED
        ADJUSTED = SkillRating.Source.MANAGER_ADJUSTED

        # Deliberate gaps below the position's required minimum, so the Gap
        # Analysis screen has real gaps to show:
        rate('casey', 'Python', 'Novice', SELF)  # below Practitioner requirement
        rate('casey', 'Git', 'Practitioner', ENDORSED)

        rate('riley', 'Python', 'Practitioner', SELF)
        rate('riley', 'Git', 'Novice', SELF)  # below Practitioner requirement

        rate('jamie', 'Python', 'Practitioner', ENDORSED)
        rate('jamie', 'Git', 'Practitioner', ENDORSED)

        rate('jordan', 'Python', 'Advanced', ENDORSED)
        rate('jordan', 'Git', 'Advanced', SELF)
        rate('jordan', 'Code Review', 'Novice', SELF)  # below Practitioner requirement

        rate('morgan', 'Python', 'Expert', ENDORSED)
        rate('morgan', 'Git', 'Advanced', SELF)
        rate('morgan', 'Code Review', 'Practitioner', ENDORSED)

        rate('taylor', 'Python', 'Practitioner', SELF)  # below Advanced requirement
        rate('taylor', 'Git', 'Advanced', ENDORSED)
        rate('taylor', 'Code Review', 'Advanced', ENDORSED)

        rate('sam', 'Python', 'Expert', ENDORSED)
        rate('sam', 'System Design', 'Advanced', SELF)
        rate('sam', 'Mentoring', 'Advanced', ENDORSED)
        rate('sam', 'Code Review', 'Expert', ENDORSED)

        rate('alex', 'Python', 'Advanced', ADJUSTED)  # below Expert requirement
        rate('alex', 'System Design', 'Advanced', SELF)
        rate('alex', 'Mentoring', 'Practitioner', SELF)
        rate('alex', 'Code Review', 'Advanced', ENDORSED)

        rate('priya', 'Leadership', 'Expert', ENDORSED)
        rate('priya', 'System Design', 'Expert', SELF)
        rate('priya', 'Communication', 'Advanced', ENDORSED)

        rate('drew', 'CRM Tools', 'Expert', ENDORSED)
        rate('drew', 'Negotiation', 'Advanced', SELF)
        rate('drew', 'Contract Negotiation', 'Advanced', ENDORSED)

        rate('skyler', 'CRM Tools', 'Practitioner', SELF)
        rate('skyler', 'Prospecting', 'Novice', SELF)  # below Practitioner requirement

        rate('quinn', 'CRM Tools', 'Advanced', ENDORSED)
        rate('quinn', 'Prospecting', 'Practitioner', SELF)

        # A couple of self-assessments outside their position's requirements,
        # demonstrating employees can rate any skill in the taxonomy.
        rate('harper', 'Data Analysis', 'Advanced', SELF)
        rate('reese', 'Leadership', 'Expert', SELF)

    # -- Certifications -------------------------------------------------------

    def _seed_certifications(self, employees, skills):
        today = timezone.now().date()

        aws_cert = Certification.objects.create(
            name='AWS Certified Developer', issuing_body='Amazon', validity_period_months=36,
            related_skill=skills['Python'],
        )
        pmp_cert = Certification.objects.create(
            name='PMP', issuing_body='PMI', validity_period_months=36,
            related_skill=skills['Leadership'],
        )
        sales_cert = Certification.objects.create(
            name='Certified Sales Professional', issuing_body='NASP', validity_period_months=24,
            related_skill=skills['Negotiation'],
        )

        EmployeeCertification.objects.create(
            employee=employees['sam'], certification=aws_cert,
            issued_at=today - datetime.timedelta(days=400),
            expires_at=today + datetime.timedelta(days=400),  # ACTIVE
        )
        EmployeeCertification.objects.create(
            employee=employees['priya'], certification=pmp_cert,
            issued_at=today - datetime.timedelta(days=700),
            expires_at=today + datetime.timedelta(days=20),  # PENDING_RENEWAL — expiring soon
        )
        EmployeeCertification.objects.create(
            employee=employees['drew'], certification=sales_cert,
            issued_at=today - datetime.timedelta(days=100),
            expires_at=today + datetime.timedelta(days=600),  # ACTIVE
        )
        EmployeeCertification.objects.create(
            employee=employees['casey'], certification=aws_cert,
            issued_at=today - datetime.timedelta(days=1000),
            expires_at=today - datetime.timedelta(days=30),  # EXPIRED
        )

    # -- Learning resources ---------------------------------------------------

    def _seed_learning_resources(self, skills):
        LearningResource.objects.create(
            title='Python for Engineers', provider_url='https://example.com/python-course',
            skill=skills['Python'], level='Practitioner',
        )
        LearningResource.objects.create(
            title='Advanced System Design', provider_url='https://example.com/system-design',
            skill=skills['System Design'], level='Advanced',
        )
        LearningResource.objects.create(
            title='Negotiation Mastery', provider_url='https://example.com/negotiation',
            skill=skills['Negotiation'], level='Advanced',
        )
        LearningResource.objects.create(
            title='SQL Fundamentals', provider_url='https://example.com/sql-basics',
            skill=skills['SQL'], level='Novice',
        )
