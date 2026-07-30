from django.contrib import admin

from .models import LearningResource


@admin.register(LearningResource)
class LearningResourceAdmin(admin.ModelAdmin):
    list_display = ('title', 'skill', 'level', 'provider_url')
    list_filter = ('skill',)
    search_fields = ('title',)
