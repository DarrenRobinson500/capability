from rest_framework import serializers

from config.serializers import ModelCleanOnSaveMixin

from .models import PositionRequirement, ProficiencyScale, Skill, SkillCategory, SkillRating


class SkillCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillCategory
        fields = ['id', 'name', 'parent_category']


class SkillSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Skill
        fields = ['id', 'name', 'category', 'category_name', 'description', 'taxonomy_version']

    def get_category_name(self, obj):
        return obj.category.name


class ProficiencyScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProficiencyScale
        fields = ['id', 'skill', 'levels']


class SkillRatingSerializer(ModelCleanOnSaveMixin, serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    skill_name = serializers.SerializerMethodField()

    class Meta:
        model = SkillRating
        fields = [
            'id', 'employee', 'employee_name', 'skill', 'skill_name',
            'proficiency_level', 'source', 'evidence', 'rated_at',
        ]
        # employee is set server-side from the requesting user (self-assessment
        # only); source only changes via the endorse() action, never a direct
        # PATCH — see config/permissions.py:IsOwnSkillRatingOrReadOnly.
        read_only_fields = ['employee', 'source', 'rated_at']

    def get_employee_name(self, obj):
        return obj.employee.name

    def get_skill_name(self, obj):
        return obj.skill.name


class PositionRequirementSerializer(ModelCleanOnSaveMixin, serializers.ModelSerializer):
    skill_name = serializers.SerializerMethodField()

    class Meta:
        model = PositionRequirement
        fields = ['id', 'position', 'skill', 'skill_name', 'min_proficiency', 'required', 'defined_by']
        read_only_fields = ['defined_by']

    def get_skill_name(self, obj):
        return obj.skill.name
