from django.core.exceptions import ValidationError
from django.db import models


class SkillCategory(models.Model):
    name = models.CharField(max_length=200)
    parent_category = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='subcategories'
    )

    class Meta:
        verbose_name_plural = 'skill categories'

    def __str__(self):
        return self.name


class Skill(models.Model):
    name = models.CharField(max_length=200)
    category = models.ForeignKey(SkillCategory, on_delete=models.PROTECT, related_name='skills')
    description = models.TextField(blank=True)
    # Bumped on meaningful redefinition of what this skill means, so old
    # ratings against a prior definition can be told apart from current ones.
    taxonomy_version = models.IntegerField(default=1)

    class Meta:
        unique_together = ('name', 'category')

    def __str__(self):
        return self.name


class ProficiencyScale(models.Model):
    """An ordered list of proficiency level names. skill=None applies as the
    global default scale for any skill without its own scale.
    """

    skill = models.ForeignKey(
        Skill, null=True, blank=True, on_delete=models.CASCADE, related_name='proficiency_scales'
    )
    levels = models.JSONField(default=list)

    def __str__(self):
        return f'Scale for {self.skill}' if self.skill else 'Default scale'


def get_scale_for_skill(skill):
    """The skill's own scale if it has one, else the global default scale."""
    scale = ProficiencyScale.objects.filter(skill=skill).first()
    if scale is None:
        scale = ProficiencyScale.objects.filter(skill__isnull=True).first()
    return scale


class SkillRating(models.Model):
    class Source(models.TextChoices):
        SELF = 'SELF', 'Self'
        MANAGER_ENDORSED = 'MANAGER_ENDORSED', 'Manager endorsed'
        MANAGER_ADJUSTED = 'MANAGER_ADJUSTED', 'Manager adjusted'

    employee = models.ForeignKey('people.Employee', on_delete=models.CASCADE, related_name='skill_ratings')
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='ratings')
    proficiency_level = models.CharField(max_length=100)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.SELF)
    evidence = models.TextField(blank=True)
    rated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee', 'skill')

    def clean(self):
        super().clean()
        scale = get_scale_for_skill(self.skill)
        if scale is not None and self.proficiency_level not in scale.levels:
            raise ValidationError(
                {'proficiency_level': f'Must be one of {scale.levels} for this skill.'}
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.employee} — {self.skill}: {self.proficiency_level}'


class PositionRequirement(models.Model):
    position = models.ForeignKey('orgstructure.Position', on_delete=models.CASCADE, related_name='requirements')
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='position_requirements')
    min_proficiency = models.CharField(max_length=100)
    required = models.BooleanField(default=True)
    defined_by = models.ForeignKey(
        'auth.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='defined_requirements'
    )

    class Meta:
        unique_together = ('position', 'skill')

    def clean(self):
        super().clean()
        scale = get_scale_for_skill(self.skill)
        if scale is not None and self.min_proficiency not in scale.levels:
            raise ValidationError(
                {'min_proficiency': f'Must be one of {scale.levels} for this skill.'}
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.position} requires {self.skill} >= {self.min_proficiency}'
