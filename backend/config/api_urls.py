"""API routes, mounted at /api/ by config.urls.

Populated in later phases: DRF router registrations (Phase 3) and the
custom endpoints — org-chart, gap-analysis, capability-search, etc. (Phase 4).
"""
from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})


urlpatterns = [
    path('health/', health),
]
