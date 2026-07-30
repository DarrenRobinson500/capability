from pathlib import Path

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound


def spa_index(request):
    """Serve the built React app's index.html for any non-API route.

    Looks in STATIC_ROOT first (the collectstatic output used in production),
    falling back to FRONTEND_DIST for local runs where collectstatic hasn't
    been run. React Router handles the actual client-side routing from here.
    """
    for candidate in (Path(settings.STATIC_ROOT), settings.FRONTEND_DIST):
        index_path = candidate / 'index.html'
        if index_path.exists():
            return HttpResponse(index_path.read_text(encoding='utf-8'))

    return HttpResponseNotFound(
        "Frontend build not found. Run 'npm run build' in frontend/ "
        "(and 'python manage.py collectstatic' for production)."
    )
