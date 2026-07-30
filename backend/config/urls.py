"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import include, path, re_path

from config.views import spa_index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('config.api_urls')),

    # Catch-all: anything else is a client-side React Router route.
    re_path(r'^(?!static/).*$', spa_index),
]
