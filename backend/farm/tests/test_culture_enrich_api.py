from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from farm.models import Culture
from farm.services.enrichment import EnrichmentServiceError


class CultureEnrichAPIIntegrationTest(APITestCase):
    """Deterministic API-level tests for culture enrichment endpoint."""

    def _create_culture(self, **overrides):
        payload = {
            'name': 'Tomato',
            'variety': 'Cherry',
            'seed_supplier': 'Supplier A',
            'notes': 'Existing notes https://example.com/a',
        }
        payload.update(overrides)
        return Culture.objects.create(**payload)

    def test_required_fields_guard_lists_missing_fields(self):
        cases = [
            ('name', ''),
            ('variety', ''),
            ('seed_supplier', ''),
        ]

        for field, value in cases:
            with self.subTest(field=field):
                culture = self._create_culture(**{field: value})
                response = self.client.post(
                    f'/openfarmplanner/api/cultures/{culture.id}/enrich/?mode=fill_missing',
                    {},
                    format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('message', response.data)
                self.assertIn('missing_fields', response.data)
                self.assertIn(field, response.data['missing_fields'])

    @patch('farm.views.enrich_culture_data')
    def test_llm_not_configured_returns_503(self, mock_enrich):
        culture = self._create_culture()
        mock_enrich.side_effect = EnrichmentServiceError('OPENAI_API_KEY is not configured.')

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{culture.id}/enrich/?mode=overwrite',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn('LLM not configured', response.data['message'])

    @patch('farm.views.enrich_culture_data')
    def test_successful_fill_missing_updates_fields_and_formats_notes(self, mock_enrich):
        culture = self._create_culture(
            expected_yield=None,
            seed_rate_value=None,
            notes='',
        )

        mock_enrich.return_value = (
            {
                'expected_yield': 3.5,
                'seed_rate_value': 1.2,
                'notes': 'Line 1\nLine 2',
            },
            ['https://supplier.example/tomato'],
            {'parsed_keys': ['expected_yield', 'seed_rate_value', 'notes', 'sources']},
        )

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{culture.id}/enrich/?mode=fill_missing',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('expected_yield', response.data['updated_fields'])
        self.assertIn('seed_rate_value', response.data['updated_fields'])
        self.assertIn('notes', response.data['updated_fields'])

        culture.refresh_from_db()
        self.assertEqual(float(culture.expected_yield), 3.5)
        self.assertEqual(float(culture.seed_rate_value), 1.2)
        self.assertIn('### Quellen', culture.notes)

    @patch('farm.views.enrich_culture_data')
    def test_successful_overwrite_replaces_existing_values(self, mock_enrich):
        culture = self._create_culture(
            expected_yield=1.0,
            seed_rate_value=0.5,
            notes='Old notes Quellen: https://old.example',
        )

        mock_enrich.return_value = (
            {
                'expected_yield': 4.2,
                'seed_rate_value': 0.9,
                'notes': 'New summary',
            },
            ['https://supplier.example/new'],
            {'parsed_keys': ['expected_yield', 'seed_rate_value', 'notes', 'sources']},
        )

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{culture.id}/enrich/?mode=overwrite',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        culture.refresh_from_db()
        self.assertEqual(float(culture.expected_yield), 4.2)
        self.assertEqual(float(culture.seed_rate_value), 0.9)
        self.assertIn('New summary', culture.notes)

    @patch('farm.views.enrich_culture_data')
    def test_no_enrichable_fields_returned_results_in_200_and_no_db_change(self, mock_enrich):
        culture = self._create_culture(
            expected_yield=1.7,
            notes='Keep me',
        )

        mock_enrich.return_value = ({}, [], {'parsed_keys': []})

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{culture.id}/enrich/?mode=overwrite',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated_fields'], [])

        culture.refresh_from_db()
        self.assertEqual(float(culture.expected_yield), 1.7)
        self.assertEqual(culture.notes, 'Keep me')
