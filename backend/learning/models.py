from django.db import models


class LearningResource(models.Model):
    title = models.CharField(max_length=200)
    provider_url = models.URLField()
    skill = models.ForeignKey('skills.Skill', on_delete=models.CASCADE, related_name='learning_resources')
    level = models.CharField(max_length=100)

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title
