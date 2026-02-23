"""Tests for LLM enrichment service utilities."""

from farm.services.enrichment import _extract_json_object


def test_extract_json_object_parses_wrapped_json():
    payload = '```json\n{"notes":"x","sources":["https://a"]}\n```'
    parsed = _extract_json_object(payload)
    assert parsed['notes'] == 'x'
    assert parsed['sources'] == ['https://a']
