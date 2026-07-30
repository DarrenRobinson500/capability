from django.contrib import admin

from .models import Certification, EmployeeCertification


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = ('name', 'issuing_body', 'validity_period_months', 'related_skill')
    search_fields = ('name', 'issuing_body')


@admin.register(EmployeeCertification)
class EmployeeCertificationAdmin(admin.ModelAdmin):
    list_display = ('employee', 'certification', 'issued_at', 'expires_at', 'status')
    list_filter = ('certification',)
    search_fields = ('employee__name', 'certification__name')
