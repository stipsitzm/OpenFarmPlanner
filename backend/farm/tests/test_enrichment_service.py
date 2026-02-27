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




    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_note_blocks_object_is_coerced_into_notes(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":{"title":"Quellen","content":"- x"}}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertIn('notes', result['suggested_fields'])
        self.assertIn('"title": "Quellen"', result['suggested_fields']['notes']['value'])


    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_normalizes_cultivation_type_aliases(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{"cultivation_type":{"value":"bush bean","unit":null,"confidence":0.9}},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":""}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertEqual(result['suggested_fields']['cultivation_type']['value'], 'direct_sowing')


    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_drops_invalid_enum_values_not_in_model_choices(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{"cultivation_type":{"value":"totally_invalid","unit":null,"confidence":0.9}},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":""}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertNotIn('cultivation_type', result['suggested_fields'])
        self.assertTrue(any(w.get('code') == 'invalid_choice_dropped' for w in result['validation']['warnings']))

    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_invalid_suggested_fields_type_raises_clear_error(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":[],"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":"ok"}'
        }
        post_mock.return_value = response

        with self.assertRaises(EnrichmentError):
            enrich_culture(self.culture, 'complete')

class EnrichmentConfigBehaviorTest(TestCase):
    def setUp(self):
        self.culture = Culture.objects.create(name='Möhre', variety='Nantes')

    @override_settings(AI_ENRICHMENT_ENABLED=False)
    def test_enrich_culture_rejects_when_disabled(self):
        with self.assertRaises(EnrichmentError):
            enrich_culture(self.culture, 'complete')

    @override_settings(AI_ENRICHMENT_PROVIDER={'bad': 'type'})
    def test_invalid_provider_type_raises_clear_error(self):
        with self.assertRaises(EnrichmentError):
            enrich_culture(self.culture, 'complete')

    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY={'bad': 'type'})
    def test_invalid_key_type_raises_clear_error(self):
        with self.assertRaises(EnrichmentError):
            enrich_culture(self.culture, 'complete')
