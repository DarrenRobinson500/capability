from django.core.exceptions import ValidationError
from django.db import models


class SkillCategory(models.Model):
    name = models.CharField(max_length=200)
    parent_category = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='subcategories'
    )
    # HR-controlled display order (drag-to-reorder), not alphabetical —
    # see SkillCategoryViewSet.reorder().
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = 'skill categories'
        ordering = ['order']

    def __str__(self):
        return self.name


class Skill(models.Model):
    name = models.CharField(max_length=200)
    category = models.ForeignKey(SkillCategory, on_delete=models.PROTECT, related_name='skills')
    description = models.TextField(blank=True)
    # Bumped on meaningful redefinition of what this skill means, so old
    # ratings against a prior definition can be told apart from current ones.
    taxonomy_version = models.IntegerField(default=1)
    # HR-controlled display order within its category — see SkillViewSet.reorder().
    order = models.IntegerField(default=0)
    # {level_name: what this level actually means for THIS skill} — every
    # skill shares the same level *names* (ProficiencyScale.levels below),
    # but what each one means varies per skill. Optional per level.
    level_descriptions = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ('name', 'category')
        ordering = ['category__order', 'order']

    def clean(self):
        super().clean()
        unknown = set(self.level_descriptions) - set(get_proficiency_levels())
        if unknown:
            raise ValidationError(
                {'level_descriptions': f'Unknown level(s) not in the shared proficiency scale: {sorted(unknown)}'}
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProficiencyScale(models.Model):
    """The single shared, ordered list of proficiency level names used by
    every skill (e.g. Novice < Practitioner < Advanced < Expert) — HR-
    editable, but there is only ever one row. What each level actually means
    varies per skill instead — see Skill.level_descriptions.
    """

    levels = models.JSONField(default=list)

    def clean(self):
        super().clean()
        if self.pk is None and ProficiencyScale.objects.exists():
            raise ValidationError('Only one proficiency scale can exist — edit the existing one instead.')

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return 'Proficiency scale'


def get_proficiency_levels():
    """The single shared ordered list of level names, or [] if not yet configured."""
    scale = ProficiencyScale.objects.first()
    return scale.levels if scale else []


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
        ordering = ['-rated_at']

    def clean(self):
        super().clean()
        levels = get_proficiency_levels()
        if levels and self.proficiency_level not in levels:
            raise ValidationError({'proficiency_level': f'Must be one of {levels}.'})

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
        ordering = ['id']

    def clean(self):
        super().clean()
        levels = get_proficiency_levels()
        if levels and self.min_proficiency not in levels:
            raise ValidationError({'min_proficiency': f'Must be one of {levels}.'})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.position} requires {self.skill} >= {self.min_proficiency}'
