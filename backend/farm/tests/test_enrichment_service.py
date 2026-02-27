import json

import requests
from unittest.mock import Mock, patch

from django.test import TestCase, override_settings

from farm.models import Culture, EnrichmentAccountingRun, SeedPackage
from farm.services.enrichment import (
    EnrichmentError,
    OpenAIResponsesProvider,
    _build_cost_estimate,
    _count_web_search_calls,
    enrich_culture,
)


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
        self.assertIn('## Quellen', result['suggested_fields']['notes']['value'])

    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_note_blocks_stringified_json_blocks_are_rendered_and_deduplicated(self, post_mock):
        response = Mock()
        response.status_code = 200
        duplicated_blocks = (
            '{"title":"Dauerwerte","content":"- Reifezeit: ca. 110 Tage."}'
            ' {"title":"Dauerwerte","content":"- Reifezeit: ca. 110 Tage."}'
            ' {"title":"Quellen","content":"- https://example.org"}'
        )
        response.json.return_value = {
            'output_text': '{"suggested_fields":{},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":' + json.dumps(duplicated_blocks) + '}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        notes = result['suggested_fields']['notes']['value']
        self.assertEqual(notes.count('## Dauerwerte'), 1)
        self.assertEqual(notes.count('## Quellen'), 1)



    @override_settings(AI_ENRICHMENT_PROVIDER='fallback', OPENAI_API_KEY='')
    def test_persists_accounting_run_for_each_invocation(self):
        result = enrich_culture(self.culture, 'complete')

        self.assertIn('usage', result)
        self.assertIn('costEstimate', result)
        self.assertEqual(EnrichmentAccountingRun.objects.count(), 1)
        run = EnrichmentAccountingRun.objects.first()
        self.assertEqual(run.culture_id, self.culture.id)
        self.assertEqual(run.provider, 'fallback')

    @patch('farm.services.enrichment.requests.post')
    def test_complete_prompt_includes_missing_fields_only_instruction(self, post_mock):
        self.culture.growth_duration_days = 110
        self.culture.save(update_fields=['growth_duration_days'])
        provider = OpenAIResponsesProvider(api_key='test-key')
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":""}'
        }
        post_mock.return_value = response

        provider.enrich(Mock(culture=self.culture, mode='complete'))

        sent_input = post_mock.call_args.kwargs['json']['input']
        self.assertIn("ONLY research and suggest these missing fields", sent_input)
        self.assertNotIn('growth_duration_days', sent_input.split("ONLY research and suggest these missing fields:", 1)[1].split('.', 1)[0])


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
    def test_complete_mode_keeps_only_missing_fields(self, post_mock):
        self.culture.growth_duration_days = 110
        self.culture.harvest_duration_days = None
        self.culture.harvest_method = 'per_sqm'
        self.culture.expected_yield = 1.5
        self.culture.save(update_fields=['growth_duration_days', 'harvest_duration_days', 'harvest_method', 'expected_yield'])
        SeedPackage.objects.create(culture=self.culture, size_value=500, size_unit='g', available=True)

        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{"growth_duration_days":{"value":120,"unit":"days","confidence":0.8},"harvest_duration_days":{"value":60,"unit":"days","confidence":0.8},"harvest_method":{"value":"per plant","unit":null,"confidence":0.7},"expected_yield":{"value":2.1,"unit":"kg/m²","confidence":0.7},"seed_packages":{"value":[{"size_value":750,"size_unit":"g","available":true}],"unit":null,"confidence":0.7}},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":""}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertNotIn('growth_duration_days', result['suggested_fields'])
        self.assertIn('harvest_duration_days', result['suggested_fields'])
        self.assertNotIn('harvest_method', result['suggested_fields'])
        self.assertNotIn('expected_yield', result['suggested_fields'])
        self.assertNotIn('seed_packages', result['suggested_fields'])


    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_normalizes_harvest_method_aliases(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{"harvest_method":{"value":"per m2","unit":null,"confidence":0.9}} ,"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":""}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertEqual(result['suggested_fields']['harvest_method']['value'], 'per_sqm')


    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_builds_structured_sources_from_evidence(self, post_mock):
        self.culture.variety = 'Faraday'
        self.culture.seed_supplier = 'ReinSaat'
        self.culture.save(update_fields=['variety', 'seed_supplier'])

        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': json.dumps({
                'suggested_fields': {},
                'evidence': {
                    'expected_yield': [
                        {
                            'source_url': 'https://example.com/faraday',
                            'title': 'Faraday - ReinSaat',
                            'retrieved_at': '2026-01-01T00:00:00Z',
                            'snippet': 'Buschbohne Faraday bei ReinSaat',
                        },
                        {
                            'source_url': 'https://example.com/beans-guide',
                            'title': 'Buschbohnen Leitfaden',
                            'retrieved_at': '2026-01-01T00:00:00Z',
                            'snippet': 'Allgemeine Hinweise zu Buschbohnen',
                        },
                    ],
                },
                'validation': {'warnings': [], 'errors': []},
                'note_blocks': '## Dauerwerte\n- x',
            }, ensure_ascii=False),
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertIn('structured_sources', result)
        source_types = {entry.get('type') for entry in result['structured_sources']}
        self.assertIn('variety_specific', source_types)
        self.assertIn('general_crop', source_types)


    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_rejects_suspicious_fractional_seed_package_without_explicit_evidence(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': json.dumps({
                'suggested_fields': {
                    'seed_packages': {'value': [{'size_value': 0.195, 'size_unit': 'g', 'available': True, 'evidence_text': 'computed from TKG'}], 'unit': None, 'confidence': 0.8},
                },
                'evidence': {},
                'validation': {'warnings': [], 'errors': []},
                'note_blocks': '',
            }, ensure_ascii=False),
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertEqual(result['suggested_fields']['seed_packages']['value'], [])
        warning_codes = [warning.get('code') for warning in result['validation']['warnings']]
        self.assertIn('seed_package_fractional_suspicious', warning_codes)

    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_adds_density_plausibility_warning_when_seed_density_is_high(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': json.dumps({
                'suggested_fields': {
                    'seed_rate_value': {'value': 30, 'unit': 'seeds/m', 'confidence': 0.8},
                    'seed_rate_unit': {'value': 'seeds/m', 'unit': None, 'confidence': 0.8},
                    'row_spacing_cm': {'value': 40, 'unit': 'cm', 'confidence': 0.8},
                },
                'evidence': {},
                'validation': {'warnings': [], 'errors': []},
                'note_blocks': '',
            }, ensure_ascii=False),
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        warning_codes = [warning.get('code') for warning in result['validation']['warnings']]
        self.assertIn('density_out_of_range', warning_codes)


    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_defaults_harvest_method_when_harvest_data_present(self, post_mock):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{"expected_yield":{"value":0.8,"unit":"kg","confidence":0.8}},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":""}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertEqual(result['suggested_fields']['harvest_method']['value'], 'per_sqm')
        warning_codes = [warning.get('code') for warning in result['validation']['warnings']]
        self.assertIn('harvest_method_defaulted', warning_codes)

    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_reresearch_mode_keeps_existing_field_suggestions(self, post_mock):
        self.culture.growth_duration_days = 110
        self.culture.save(update_fields=['growth_duration_days'])

        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            'output_text': '{"suggested_fields":{"growth_duration_days":{"value":120,"unit":"days","confidence":0.8}},"evidence":{},"validation":{"warnings":[],"errors":[]},"note_blocks":""}'
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'reresearch')
        self.assertIn('growth_duration_days', result['suggested_fields'])



    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_complete_mode_keeps_notes_suggestion_even_when_notes_exist(self, post_mock):
        self.culture.notes = "## Dauerwerte\n- Alt"
        self.culture.save(update_fields=['notes'])

        response = Mock()
        response.status_code = 200
        note_blocks = "## Dauerwerte\n- Neu\n\n## Quellen\n- https://example.org"
        response.json.return_value = {
            'output_text': json.dumps({"suggested_fields": {}, "evidence": {}, "validation": {"warnings": [], "errors": []}, "note_blocks": note_blocks}, ensure_ascii=False)
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        self.assertIn('notes', result['suggested_fields'])
        self.assertIn('## Dauerwerte', result['suggested_fields']['notes']['value'])

    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_notes_are_integrated_with_clean_section_order(self, post_mock):
        self.culture.notes = (
            "Hinweis: bestehend.\n\n"
            "## Ernte & Verwendung\n- Alt Ernte.\n\n"
            "## Quellen\n- https://old.example"
        )
        self.culture.save(update_fields=['notes'])

        response = Mock()
        response.status_code = 200
        note_blocks = "## Dauerwerte\n- Neu Dauer.\n\n## Ernte & Verwendung\n- Neu Ernte.\n\n## Quellen\n- https://new.example"
        response.json.return_value = {
            'output_text': json.dumps({"suggested_fields": {}, "evidence": {}, "validation": {"warnings": [], "errors": []}, "note_blocks": note_blocks}, ensure_ascii=False)
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        notes = result['suggested_fields']['notes']['value']
        self.assertTrue(notes.startswith('Hinweis: bestehend.'))
        self.assertIn('## Dauerwerte\n- Neu Dauer.', notes)
        self.assertIn('## Ernte & Verwendung\n- Neu Ernte.', notes)
        self.assertNotIn('https://old.example', notes)
        self.assertIn('## Quellen\n- https://new.example', notes)
        self.assertIn('Hinweis: Für folgende Felder konnten keine verlässlichen Informationen ermittelt werden:', notes)




    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_complete_mode_adds_warning_and_note_hint_for_unresolved_fields(self, post_mock):
        self.culture.notes = "## Dauerwerte\n- Alt"
        self.culture.growth_duration_days = 110
        self.culture.save(update_fields=['notes', 'growth_duration_days'])

        response = Mock()
        response.status_code = 200
        note_blocks = "## Dauerwerte\n- Neu\n\n## Quellen\n- https://example.org"
        response.json.return_value = {
            'output_text': json.dumps({
                "suggested_fields": {
                    "harvest_duration_days": {"value": 60, "unit": "days", "confidence": 0.8}
                },
                "evidence": {},
                "validation": {"warnings": [], "errors": []},
                "note_blocks": note_blocks,
            }, ensure_ascii=False)
        }
        post_mock.return_value = response

        result = enrich_culture(self.culture, 'complete')
        warning_codes = [warning.get('code') for warning in result['validation']['warnings']]
        self.assertIn('fields_still_missing_after_research', warning_codes)
        self.assertIn('Hinweis: Für folgende Felder konnten keine verlässlichen Informationen ermittelt werden:', result['suggested_fields']['notes']['value'])


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

    @override_settings(AI_ENRICHMENT_PROVIDER='openai_responses', OPENAI_API_KEY='test-key')
    @patch('farm.services.enrichment.requests.post')
    def test_provider_error_is_not_auto_fallback_by_default(self, post_mock):
        post_mock.side_effect = requests.RequestException('boom')

        with self.assertRaises(EnrichmentError):
            enrich_culture(self.culture, 'complete')

    @override_settings(
        AI_ENRICHMENT_PROVIDER='openai_responses',
        OPENAI_API_KEY='test-key',
        AI_ENRICHMENT_AUTO_FALLBACK_ON_ERROR=True,
    )
    @patch('farm.services.enrichment.requests.post')
    def test_provider_error_uses_fallback_when_opted_in(self, post_mock):
        post_mock.side_effect = requests.RequestException('boom')

        result = enrich_culture(self.culture, 'complete')
        warning_codes = [warning.get('code') for warning in result['validation']['warnings']]
        self.assertIn('fallback_mode', warning_codes)


class EnrichmentCostEstimateTest(TestCase):
    def test_cost_estimate_without_cached_tokens(self):
        estimate = _build_cost_estimate(
            input_tokens=1000,
            cached_input_tokens=0,
            output_tokens=500,
            web_search_call_count=0,
            model='gpt-4.1',
        )

        self.assertEqual(estimate['currency'], 'USD')
        self.assertAlmostEqual(estimate['breakdown']['input'], 0.002, places=6)
        self.assertAlmostEqual(estimate['breakdown']['output'], 0.004, places=6)
        self.assertAlmostEqual(estimate['breakdown']['subtotal'], 0.006, places=6)
        self.assertAlmostEqual(estimate['breakdown']['tax'], 0.0012, places=6)
        self.assertAlmostEqual(estimate['total'], 0.0072, places=6)

    def test_cost_estimate_with_cached_tokens(self):
        estimate = _build_cost_estimate(
            input_tokens=2000,
            cached_input_tokens=500,
            output_tokens=0,
            web_search_call_count=0,
            model='gpt-4.1',
        )

        self.assertAlmostEqual(estimate['breakdown']['input'], 0.003, places=6)
        self.assertAlmostEqual(estimate['breakdown']['cached_input'], 0.00025, places=6)
        self.assertAlmostEqual(estimate['total'], 0.0039, places=6)

    def test_cost_estimate_with_web_search_calls(self):
        estimate = _build_cost_estimate(
            input_tokens=0,
            cached_input_tokens=0,
            output_tokens=0,
            web_search_call_count=3,
            model='gpt-4.1',
        )

        self.assertEqual(estimate['breakdown']['web_search_call_count'], 3)
        self.assertAlmostEqual(estimate['breakdown']['web_search_calls'], 0.03, places=6)
        self.assertAlmostEqual(estimate['total'], 0.036, places=6)

    def test_counts_web_search_calls_from_output_items(self):
        payload = {
            'output': [
                {'type': 'web_search_call'},
                {'type': 'tool_call', 'name': 'web_search_preview'},
                {'type': 'message'},
            ]
        }

        self.assertEqual(_count_web_search_calls(payload), 2)
