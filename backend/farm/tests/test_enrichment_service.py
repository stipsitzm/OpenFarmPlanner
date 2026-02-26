from unittest.mock import Mock, patch

from django.test import TestCase, override_settings

from farm.models import Culture
from farm.services.enrichment import EnrichmentError, OpenAIResponsesProvider, enrich_culture


class OpenAIResponsesProviderParsingTest(TestCase):
    def setUp(self):
        self.culture = Culture.objects.create(name='Bohne', variety='Test')

    @patch('farm.services.enrichment.requests.post')
    def test_parses_output_text_json(self, post_mock):
        provider = OpenAIResponsesProvider(api_key='test-key')
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":"## Quellen\\n- x"}'
        }
        post_mock.return_value = response

        parsed = provider.enrich(Mock(culture=self.culture, mode='complete'))
        self.assertIn('suggested_fields', parsed)

    @patch('farm.services.enrichment.requests.post')
    def test_parses_message_content_when_output_text_empty(self, post_mock):
        provider = OpenAIResponsesProvider(api_key='test-key')
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output': [
                {
                    'type': 'message',
                    'content': [
                        {'type': 'output_text', 'text': '```json\n{"suggested_fields":{},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":"## Quellen\\n- y"}\n```'}
                    ],
                }
            ]
        }
        post_mock.return_value = response

        parsed = provider.enrich(Mock(culture=self.culture, mode='reresearch'))
        self.assertIn('validation', parsed)

    def test_missing_key_raises_clear_error(self):
        with self.assertRaises(EnrichmentError):
            OpenAIResponsesProvider(api_key='')


class EnrichmentConfigBehaviorTest(TestCase):
    def setUp(self):
        self.culture = Culture.objects.create(name='Möhre', variety='Nantes')

    @override_settings(AI_ENRICHMENT_ENABLED=False)
    def test_enrich_culture_rejects_when_disabled(self):
        with self.assertRaises(EnrichmentError):
            enrich_culture(self.culture, 'complete')
