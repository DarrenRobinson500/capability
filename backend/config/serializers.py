from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


class ModelCleanOnSaveMixin:
    """Several models (Position, SkillRating, PositionRequirement) call
    self.clean() from their own save() and raise Django's ValidationError on
    invalid data (e.g. a Position cycle, an out-of-scale proficiency level).
    Without this, that exception would surface as an unhandled 500 through
    the API instead of a normal 400 response.
    """

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(getattr(exc, 'message_dict', exc.messages))

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(getattr(exc, 'message_dict', exc.messages))
