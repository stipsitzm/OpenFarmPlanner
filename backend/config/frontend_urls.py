from __future__ import annotations

from django.conf import settings


def get_public_frontend_base_url() -> str:
    """Return the configured public frontend base URL without trailing slash."""
    return settings.PUBLIC_FRONTEND_URL.rstrip('/')


def build_public_frontend_url(path_with_query: str) -> str:
    """Build a public frontend URL from configured base and relative path."""
    if not path_with_query.startswith('/'):
        path_with_query = f'/{path_with_query}'
    return f'{get_public_frontend_base_url()}{path_with_query}'
