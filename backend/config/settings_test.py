"""Test settings for running tests with SQLite database."""

from .settings import *  # noqa: F403, F401

# Override database to use SQLite for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
