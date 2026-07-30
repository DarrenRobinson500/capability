from rest_framework import serializers

from .models import LearningResource


class LearningResourceSerializer(serializers.ModelSerializer):
    skill_name = serializers.SerializerMethodField()

    class Meta:
        model = LearningResource
        fields = ['id', 'title', 'provider_url', 'skill', 'skill_name', 'level']

    def get_skill_name(self, obj):
        return obj.skill.name
