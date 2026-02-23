"""Culture enrichment service using an LLM endpoint."""

from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class EnrichmentServiceError(Exception):
    """Raised when enrichment cannot be completed."""


ENRICH_FIELD_WHITELIST: tuple[str, ...] = (
    'crop_family',
    'nutrient_demand',
    'cultivation_type',
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'harvest_method',
    'expected_yield',
    'distance_within_row_cm',
    'row_spacing_cm',
    'sowing_depth_cm',
    'seed_rate_value',
    'seed_rate_unit',
    'sowing_calculation_safety_percent',
    'thousand_kernel_weight_g',
    'package_size_g',
    'notes',
)


def _build_system_prompt() -> str:
    return (
        'You are an agronomy research assistant for vegetable cultivation data. '
        'Return ONLY valid JSON without markdown. '
        'Use conservative values, avoid guessing if uncertain. '
        'Allowed output keys are strictly limited to the provided whitelist. '
        'The notes field must be plain text (single line), concise, and must NOT contain a Quellen section; '
        'sources must be returned separately in the sources array.'
    )


def _build_user_prompt(culture_data: dict[str, Any], source_urls: list[str], mode: str, target_fields: list[str]) -> str:
    payload = {
        'culture': culture_data,
        'source_urls': source_urls,
        'mode': mode,
        'target_fields': target_fields,
        'output_contract': {
            'fields': list(ENRICH_FIELD_WHITELIST),
            'sources': 'array of source URLs used for extraction',
            'constraints': {
                'only_allowed_fields': True,
                'omit_unknown_fields': True,
                'notes_single_line': True,
            },
        },
    }
    return json.dumps(payload, ensure_ascii=False)


def _extract_json_object(content: str) -> dict[str, Any]:
    content = content.strip()
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{.*\}', content, re.DOTALL)
    if not match:
        raise EnrichmentServiceError('LLM response does not contain a JSON object.')

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise EnrichmentServiceError('LLM response JSON is invalid.') from exc

    if not isinstance(parsed, dict):
        raise EnrichmentServiceError('LLM response JSON must be an object.')
    return parsed


def enrich_culture_data(culture_data: dict[str, Any], source_urls: list[str], mode: str = 'overwrite', target_fields: list[str] | None = None) -> tuple[dict[str, Any], list[str], dict[str, Any]]:
    """Call LLM and return whitelisted field updates and source URLs."""
    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if not api_key:
        raise EnrichmentServiceError('OPENAI_API_KEY is not configured.')

    model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini').strip() or 'gpt-4o-mini'
    base_url = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    timeout = int(os.getenv('OPENAI_TIMEOUT_SECONDS', '40'))

    effective_target_fields = target_fields or list(ENRICH_FIELD_WHITELIST)

    body = {
        'model': model,
        'response_format': {'type': 'json_object'},
        'temperature': 0.2,
        'messages': [
            {'role': 'system', 'content': _build_system_prompt()},
            {'role': 'user', 'content': _build_user_prompt(culture_data, source_urls, mode, effective_target_fields)},
        ],
    }

    request = Request(
        url=f'{base_url}/chat/completions',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            raw_response = response.read().decode('utf-8')
    except HTTPError as exc:
        raise EnrichmentServiceError('LLM request failed.') from exc
    except URLError as exc:
        raise EnrichmentServiceError('LLM request failed.') from exc

    try:
        response_json = json.loads(raw_response)
        content = response_json['choices'][0]['message']['content']
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise EnrichmentServiceError('LLM response format is invalid.') from exc

    parsed = _extract_json_object(content)

    sources = parsed.get('sources', [])
    if not isinstance(sources, list):
        sources = []
    normalized_sources = [str(url).strip() for url in sources if str(url).strip()]

    updates: dict[str, Any] = {}
    for field in ENRICH_FIELD_WHITELIST:
        if field in parsed:
            updates[field] = parsed[field]

    notes = updates.get('notes')
    if notes is not None:
        updates['notes'] = str(notes).replace('\r', ' ').replace('\n', ' ').strip()

    debug = {
        'model': model,
        'mode': mode,
        'target_fields': effective_target_fields,
        'parsed_keys': list(parsed.keys()),
        'returned_update_keys': list(updates.keys()),
        'returned_sources_count': len(normalized_sources),
    }

    return updates, normalized_sources, debug
