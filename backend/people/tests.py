from django.contrib.auth.models import User
from django.test import Client, TestCase

from .models import Employee, Profile


class CreateUserViewTests(TestCase):
    """There's no self-registration anywhere in this app — /api/users/create/
    is the only way to provision a new login, and it's HR Admin only.
    """

    def setUp(self):
        self.hr_user = User.objects.create_user('hr_creator', password='x')
        self.hr_user.profile.role = Profile.Role.HR_ADMIN
        self.hr_user.profile.save()

        self.manager_user = User.objects.create_user('manager_creator', password='x')
        self.manager_user.profile.role = Profile.Role.MANAGER
        self.manager_user.profile.save()

    def test_non_hr_admin_is_blocked(self):
        client = Client()
        client.force_login(self.manager_user)
        response = client.post(
            '/api/users/create/',
            {'username': 'blocked', 'password': 'pw12345', 'role': 'EMPLOYEE'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username='blocked').exists())

    def test_hr_admin_creates_user_and_employee(self):
        client = Client()
        client.force_login(self.hr_user)
        response = client.post(
            '/api/users/create/',
            {
                'username': 'newhire',
                'password': 'pw12345',
                'role': 'MANAGER',
                'employee_name': 'New Hire',
                'location': 'Remote',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)

        new_user = User.objects.get(username='newhire')
        self.assertEqual(new_user.profile.role, Profile.Role.MANAGER)
        employee = Employee.objects.get(user=new_user)
        self.assertEqual(employee.name, 'New Hire')
        self.assertEqual(employee.location, 'Remote')

        # the created login actually works
        login_client = Client()
        login_response = login_client.post(
            '/api/auth/login/', {'username': 'newhire', 'password': 'pw12345'}, content_type='application/json'
        )
        self.assertEqual(login_response.status_code, 200)

    def test_hr_admin_creates_user_without_employee(self):
        client = Client()
        client.force_login(self.hr_user)
        response = client.post(
            '/api/users/create/',
            {'username': 'execonly', 'password': 'pw12345', 'role': 'EXECUTIVE'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()['employee_id'])
        self.assertFalse(Employee.objects.filter(user__username='execonly').exists())

    def test_duplicate_username_rejected(self):
        client = Client()
        client.force_login(self.hr_user)
        response = client.post(
            '/api/users/create/',
            {'username': 'hr_creator', 'password': 'pw12345', 'role': 'EMPLOYEE'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_role_rejected(self):
        client = Client()
        client.force_login(self.hr_user)
        response = client.post(
            '/api/users/create/',
            {'username': 'someone', 'password': 'pw12345', 'role': 'SUPERUSER'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='someone').exists())
