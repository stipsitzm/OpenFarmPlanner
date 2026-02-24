"""Tests for LLM enrichment service utilities."""

from unittest.mock import patch

from farm.services.enrichment import _extract_json_object, enrich_culture_data


def test_extract_json_object_parses_wrapped_json():
    payload = '```json\n{"notes":"x","sources":["https://a"]}\n```'
    parsed = _extract_json_object(payload)
    assert parsed['notes'] == 'x'
    assert parsed['sources'] == ['https://a']


@patch('farm.services.enrichment._call_llm_extract')
@patch('farm.services.enrichment.fetch_page_text')
@patch('farm.services.enrichment.web_search')
def test_enrich_culture_data_pipeline_with_mocked_search_and_fetch(mock_search, mock_fetch, mock_llm):
    mock_search.return_value = [
        {'url': 'https://supplier.example/peas', 'title': 'Supplier', 'snippet': 'Data'},
        {'url': 'https://wiki.example/pea', 'title': 'Wiki', 'snippet': 'Data'},
    ]
    mock_fetch.side_effect = ['Supplier page text', 'Wiki page text']
    mock_llm.return_value = {
        'harvest_duration_days': 21,
        'notes': 'Extracted markdown summary',
        'sources': ['https://supplier.example/peas'],
    }

    updates, sources, debug = enrich_culture_data(
        {
            'name': 'Erbse',
            'variety': 'Norli',
            'seed_supplier': 'Reinsaat',
        },
        source_urls=[],
        mode='fill_missing',
        target_fields=['harvest_duration_days', 'notes'],
    )

    assert updates['harvest_duration_days'] == 21
    assert updates['notes'] == 'Extracted markdown summary'
    assert 'https://supplier.example/peas' in sources
    assert debug['fetched_urls_count'] == 2


@patch('farm.services.enrichment.fetch_page_text', return_value='')
@patch('farm.services.enrichment.web_search', return_value=[{'url': 'https://example.com/a', 'title': '', 'snippet': ''}])
def test_enrich_culture_data_raises_no_sources(_mock_search, _mock_fetch):
    with patch('farm.services.enrichment._call_llm_extract'):
        try:
            enrich_culture_data(
                {'name': 'Erbse', 'variety': 'Norli', 'seed_supplier': 'Reinsaat'},
                source_urls=[],
                mode='overwrite',
                target_fields=['notes'],
            )
            assert False, 'Expected exception'
        except Exception as exc:
            assert str(exc) == 'NO_SOURCES'


@patch('farm.services.enrichment._call_llm_extract')
@patch('farm.services.enrichment.fetch_page_text')
@patch('farm.services.enrichment.web_search')
def test_enrich_culture_data_adds_plausibility_warnings_and_confidence(mock_search, mock_fetch, mock_llm):
    mock_search.return_value = [
        {'url': 'https://example.com/kohlrabi-a', 'title': 'Kohlrabi Superschmelz', 'snippet': 'Info Superschmelz'},
        {'url': 'https://example.com/kohlrabi-b', 'title': 'Kohlrabi generic', 'snippet': 'General info'},
    ]
    mock_fetch.side_effect = [
        'Kohlrabi Superschmelz data',
        'Kohlrabi overview not specific to variety',
    ]
    mock_llm.return_value = {
        'crop_family': 'Brassica',
        'growth_duration_days': 130,
        'harvest_duration_days': 220,
        'seed_rate_value': 0.9,
        'seed_rate_unit': 'g_per_m2',
        'thousand_kernel_weight_g': 3.0,
        'notes': 'Kurzbeschreibung auf Deutsch',
        'sources': ['https://example.com/kohlrabi-a', 'https://example.com/kohlrabi-b'],
    }

    _updates, _sources, debug = enrich_culture_data(
        {'name': 'Kohlrabi', 'variety': 'Superschmelz', 'seed_supplier': 'Demo'},
        source_urls=[],
        mode='overwrite',
        target_fields=['crop_family', 'growth_duration_days', 'harvest_duration_days', 'seed_rate_value', 'seed_rate_unit', 'thousand_kernel_weight_g', 'notes'],
    )

    assert 'plausibility_warnings' in debug
    assert len(debug['plausibility_warnings']) > 0
    assert 'confidence_score' in debug
    assert 0.0 <= debug['confidence_score'] <= 1.0


@patch('farm.services.enrichment._call_llm_extract')
@patch('farm.services.enrichment.fetch_page_text')
@patch('farm.services.enrichment.web_search')
def test_enrich_culture_data_maps_alias_fields_and_numeric_strings(mock_search, mock_fetch, mock_llm):
    mock_search.return_value = [
        {'url': 'https://supplier.example/data', 'title': 'Supplier', 'snippet': 'Data'},
    ]
    mock_fetch.return_value = 'Supplier page text'
    mock_llm.return_value = {
        'plant_spacing_cm': '35 cm',
        'reihenabstand_cm': '45',
        'days_to_maturity': '70 Tage',
        'harvest_window_days': '18',
        'sources': ['https://supplier.example/data'],
    }

    updates, _sources, debug = enrich_culture_data(
        {'name': 'Kohlrabi', 'variety': 'Noriko', 'seed_supplier': 'Reinsaat'},
        source_urls=[],
        mode='overwrite',
        target_fields=['distance_within_row_cm', 'row_spacing_cm', 'growth_duration_days', 'harvest_duration_days'],
    )

    assert updates['distance_within_row_cm'] == 35.0
    assert updates['row_spacing_cm'] == 45.0
    assert updates['growth_duration_days'] == 70
    assert updates['harvest_duration_days'] == 18
    assert debug['alias_hits']['plant_spacing_cm'] == 'distance_within_row_cm'
