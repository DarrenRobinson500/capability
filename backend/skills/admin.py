from django.contrib import admin

from .models import PositionRequirement, ProficiencyScale, Skill, SkillCategory, SkillRating


@admin.register(SkillCategory)
class SkillCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent_category')
    search_fields = ('name',)


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'taxonomy_version')
    list_filter = ('category',)
    search_fields = ('name',)


@admin.register(ProficiencyScale)
class ProficiencyScaleAdmin(admin.ModelAdmin):
    list_display = ('skill', 'levels')


@admin.register(SkillRating)
class SkillRatingAdmin(admin.ModelAdmin):
    list_display = ('employee', 'skill', 'proficiency_level', 'source', 'rated_at')
    list_filter = ('source', 'skill')
    search_fields = ('employee__name', 'skill__name')


@admin.register(PositionRequirement)
class PositionRequirementAdmin(admin.ModelAdmin):
    list_display = ('position', 'skill', 'min_proficiency', 'required', 'defined_by')
    list_filter = ('required', 'skill')
