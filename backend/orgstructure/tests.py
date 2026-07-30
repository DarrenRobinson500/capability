from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import Client, TestCase

from people.models import Profile
from .models import Position, Role


class PositionCycleValidationTests(TestCase):
    def setUp(self):
        self.role = Role.objects.create(title='Engineer', level=1)

    def test_position_cannot_report_to_itself(self):
        position = Position.objects.create(role=self.role, department='Eng')
        position.parent_position = position
        with self.assertRaises(ValidationError):
            position.save()

    def test_position_cannot_create_a_multi_hop_cycle(self):
        grandparent = Position.objects.create(role=self.role, department='Eng')
        parent = Position.objects.create(role=self.role, department='Eng', parent_position=grandparent)
        child = Position.objects.create(role=self.role, department='Eng', parent_position=parent)

        grandparent.parent_position = child
        with self.assertRaises(ValidationError):
            grandparent.save()

    def test_reassigning_to_a_non_cyclic_parent_is_allowed(self):
        a = Position.objects.create(role=self.role, department='Eng')
        b = Position.objects.create(role=self.role, department='Eng')
        a.parent_position = b
        a.save()
        self.assertEqual(Position.objects.get(pk=a.pk).parent_position_id, b.pk)

    def test_cycle_via_api_returns_400_not_500(self):
        hr = User.objects.create_user('hradmin_cycletest', password='x')
        hr.profile.role = Profile.Role.HR_ADMIN
        hr.profile.save()

        parent = Position.objects.create(role=self.role, department='Eng')
        child = Position.objects.create(role=self.role, department='Eng', parent_position=parent)

        client = Client()
        client.force_login(hr)
        response = client.patch(
            f'/api/positions/{parent.id}/',
            {'parent_position': child.id},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('parent_position', response.json())
