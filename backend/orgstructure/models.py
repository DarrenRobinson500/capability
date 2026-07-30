from django.core.exceptions import ValidationError
from django.db import models


class Role(models.Model):
    """A reusable job template, independent of any specific org-chart slot."""

    title = models.CharField(max_length=200)
    # IntegerField (not CharField) so career-ladder ordering (e.g. Engineer I=1,
    # II=2, Senior=3) can be sorted/compared directly, not just labelled.
    level = models.IntegerField()
    parent_role = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='child_roles'
    )
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['level', 'title']

    def __str__(self):
        return f'{self.title} (L{self.level})'


class Position(models.Model):
    """A node in the org chart. parent_position=None is a root — multiple
    roots are allowed (not enforced to a single one) to support multi-entity
    companies without extra modelling.
    """

    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='positions')
    parent_position = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='direct_reports'
    )
    department = models.CharField(max_length=200)
    employee = models.OneToOneField(
        'people.Employee', null=True, blank=True, on_delete=models.SET_NULL, related_name='position'
    )

    class Meta:
        ordering = ['department', 'id']

    def clean(self):
        super().clean()
        if self.parent_position_id is None:
            return
        if self.pk is not None and self.parent_position_id == self.pk:
            raise ValidationError({'parent_position': 'A position cannot report to itself.'})

        seen = set()
        ancestor = self.parent_position
        while ancestor is not None:
            if self.pk is not None and ancestor.pk == self.pk:
                raise ValidationError(
                    {'parent_position': 'This would create a cycle in the reporting chain.'}
                )
            if ancestor.pk in seen:
                break
            seen.add(ancestor.pk)
            ancestor = ancestor.parent_position

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        who = self.employee.name if self.employee_id else 'vacant'
        return f'{self.role.title} — {self.department} ({who})'
