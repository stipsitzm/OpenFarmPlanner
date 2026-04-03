"""Test settings for running tests with SQLite database."""

import os

os.environ.setdefault('DEBUG', 'True')
os.environ.setdefault('PUBLIC_FRONTEND_URL', 'http://localhost:5173')

from .settings import *  # noqa: F403, F401

# Override database to use SQLite for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Keep existing test suite behavior focused on domain logic.
# Authentication behavior is validated separately in accounts tests.
REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES'] = [  # type: ignore[name-defined]
    'rest_framework.permissions.AllowAny',
]
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []  # type: ignore[name-defined]
