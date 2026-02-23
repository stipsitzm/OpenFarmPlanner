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
