from django.db import models


class Assignment(models.Model):
    """A project a set of skills is needed for — used by Capability Search
    style staffing lookups.
    """

    name = models.CharField(max_length=200)
    required_skills = models.ManyToManyField('skills.Skill', related_name='assignments', blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
