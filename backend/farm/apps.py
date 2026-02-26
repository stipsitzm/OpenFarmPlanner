import logging

from django.apps import AppConfig
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)


class FarmConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'farm'

    def ready(self) -> None:
        """Run startup diagnostics for AI enrichment config."""
        if getattr(settings, 'AI_STARTUP_DIAGNOSTICS', True):
            logger.info(
                "AI enrichment config: enabled=%s provider=%s openai_key_present=%s fail_fast=%s",
                getattr(settings, 'AI_ENRICHMENT_ENABLED', False),
                getattr(settings, 'AI_ENRICHMENT_PROVIDER', 'unset'),
                bool(getattr(settings, 'OPENAI_API_KEY', '')),
                getattr(settings, 'AI_ENRICHMENT_FAIL_FAST', False),
            )

        if not getattr(settings, 'AI_ENRICHMENT_ENABLED', False):
            return

        provider = getattr(settings, 'AI_ENRICHMENT_PROVIDER', 'openai_responses')
        key = getattr(settings, 'OPENAI_API_KEY', '').strip()
        fail_fast = getattr(settings, 'AI_ENRICHMENT_FAIL_FAST', False)

        if provider == 'openai_responses' and not key and fail_fast:
            raise ImproperlyConfigured(
                'AI enrichment is enabled with openai_responses, but OPENAI_API_KEY is missing.'
            )
