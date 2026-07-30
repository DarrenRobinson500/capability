from datetime import date

from django.db import models


class Certification(models.Model):
    name = models.CharField(max_length=200)
    issuing_body = models.CharField(max_length=200, blank=True)
    validity_period_months = models.IntegerField(null=True, blank=True)
    related_skill = models.ForeignKey(
        'skills.Skill', null=True, blank=True, on_delete=models.SET_NULL, related_name='certifications'
    )

    def __str__(self):
        return self.name


class EmployeeCertification(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        EXPIRED = 'EXPIRED', 'Expired'
        PENDING_RENEWAL = 'PENDING_RENEWAL', 'Pending renewal'

    employee = models.ForeignKey('people.Employee', on_delete=models.CASCADE, related_name='certifications')
    certification = models.ForeignKey(Certification, on_delete=models.CASCADE, related_name='holders')
    issued_at = models.DateField()
    expires_at = models.DateField(null=True, blank=True)

    @property
    def status(self):
        if self.expires_at is None:
            return self.Status.ACTIVE
        today = date.today()
        if self.expires_at < today:
            return self.Status.EXPIRED
        if (self.expires_at - today).days <= 30:
            return self.Status.PENDING_RENEWAL
        return self.Status.ACTIVE

    def __str__(self):
        return f'{self.employee} — {self.certification} ({self.status})'
