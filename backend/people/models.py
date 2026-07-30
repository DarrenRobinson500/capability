from django.conf import settings
from django.db import models


class Employee(models.Model):
    """A person tracked in the system. An Employee with no Position is
    "on the bench" (unassigned) — a valid state, not an error.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='employee'
    )
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Profile(models.Model):
    class Role(models.TextChoices):
        EMPLOYEE = 'EMPLOYEE', 'Employee'
        MANAGER = 'MANAGER', 'Manager'
        HR_ADMIN = 'HR_ADMIN', 'HR Admin'
        EXECUTIVE = 'EXECUTIVE', 'Executive'

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.EMPLOYEE)

    class Meta:
        ordering = ['user__username']

    def __str__(self):
        return f'{self.user.username} ({self.role})'
