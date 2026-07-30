from rest_framework import serializers

from .models import Certification, EmployeeCertification


class CertificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certification
        fields = ['id', 'name', 'issuing_body', 'validity_period_months', 'related_skill']


class EmployeeCertificationSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    certification_name = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)

    class Meta:
        model = EmployeeCertification
        fields = [
            'id', 'employee', 'employee_name', 'certification', 'certification_name',
            'issued_at', 'expires_at', 'status',
        ]

    def get_employee_name(self, obj):
        return obj.employee.name

    def get_certification_name(self, obj):
        return obj.certification.name
