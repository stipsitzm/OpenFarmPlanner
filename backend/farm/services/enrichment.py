"""Culture enrichment service with web search + page extraction + LLM extraction."""

from __future__ import annotations

import sys
import json
import os
import re
from html import unescape
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
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
        'Use conservative values, avoid guessing. '
        'Only output allowed fields. '
        'The notes field must be concise markdown (single line), and must NOT contain a Quellen section. '
        'Provide source URLs in the sources array.'
    )


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


def web_search(query: str, max_results: int = 8, include_domains: list[str] | None = None) -> list[dict[str, str]]:
    """Run Tavily search and return simplified results list."""
    import sys
    api_key = os.getenv('TAVILY_API_KEY', '').strip()
    if not api_key:
        print(f'[ENRICH DEBUG] TAVILY_API_KEY is not configured', file=sys.stderr)
        raise EnrichmentServiceError('TAVILY_API_KEY is not configured.')

    endpoint = os.getenv('TAVILY_SEARCH_URL', 'https://api.tavily.com/search').strip()
    timeout = int(os.getenv('TAVILY_TIMEOUT_SECONDS', '20'))
    body: dict[str, Any] = {
        'api_key': api_key,
        'query': query,
        'max_results': max_results,
        'search_depth': 'basic',
        'include_answer': False,
    }
    if include_domains:
        body['include_domains'] = include_domains

    request = Request(
        url=endpoint,
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except (HTTPError, URLError, ValueError) as exc:
        import sys
        print(f'[ENRICH DEBUG] Web search request failed: {exc}', file=sys.stderr)
        raise EnrichmentServiceError(f'Web search request failed: {exc}') from exc

    results = payload.get('results', [])
    simplified: list[dict[str, str]] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        url = str(item.get('url', '')).strip()
        if not url:
            continue
        simplified.append({
            'url': url,
            'title': str(item.get('title', '')).strip(),
            'snippet': str(item.get('content', '')).strip(),
        })
    return simplified


def fetch_page_text(url: str, max_chars: int = 8000) -> str:
    """Fetch URL and extract readable plain text."""
    timeout = int(os.getenv('FETCH_TIMEOUT_SECONDS', '20'))
    req = Request(
        url=url,
        headers={'User-Agent': 'OpenFarmPlanner-Enrichment/1.0'},
        method='GET',
    )

    try:
        with urlopen(req, timeout=timeout) as response:
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' not in content_type and 'text/plain' not in content_type:
                return ''
            raw = response.read().decode('utf-8', errors='ignore')
    except (HTTPError, URLError):
        return ''

    if 'text/html' in content_type:
        cleaned = re.sub(r'<script[^>]*>.*?</script>', ' ', raw, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r'<style[^>]*>.*?</style>', ' ', cleaned, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r'<[^>]+>', ' ', cleaned)
    else:
        cleaned = raw

    cleaned = unescape(cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:max_chars]


def _call_llm_extract(culture_data: dict[str, Any], source_docs: list[dict[str, str]], mode: str, target_fields: list[str]) -> dict[str, Any]:
    """Call OpenAI-compatible endpoint for extraction."""
    import sys
    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if not api_key:
        print(f'[ENRICH DEBUG] OPENAI_API_KEY is not configured', file=sys.stderr)
        raise EnrichmentServiceError('OPENAI_API_KEY is not configured.')

    model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini').strip() or 'gpt-4o-mini'
    base_url = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    timeout = int(os.getenv('OPENAI_TIMEOUT_SECONDS', '40'))

    user_payload = {
        'culture': culture_data,
        'mode': mode,
        'target_fields': target_fields,
        'source_documents': source_docs,
        'output_contract': {
            'fields': list(ENRICH_FIELD_WHITELIST),
            'sources': 'array of URLs from source_documents used for extraction',
            'constraints': {'single_line_notes': True, 'notes_without_quellen': True},
        },
    }

    body = {
        'model': model,
        'response_format': {'type': 'json_object'},
        'temperature': 0.1,
        'messages': [
            {'role': 'system', 'content': _build_system_prompt()},
            {'role': 'user', 'content': json.dumps(user_payload, ensure_ascii=False)},
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
            payload = json.loads(response.read().decode('utf-8'))
    except (HTTPError, URLError, ValueError) as exc:
        import sys
        print(f'[ENRICH DEBUG] LLM request failed: {exc}', file=sys.stderr)
        raise EnrichmentServiceError(f'LLM request failed: {exc}') from exc

    try:
        content = payload['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError) as exc:
        raise EnrichmentServiceError('LLM response format is invalid.') from exc

    return _extract_json_object(content)


def _domains_for_supplier(seed_supplier: str) -> list[str]:
    direct = seed_supplier.strip().lower().replace(' ', '')
    if not direct:
        return []
    return [f'{direct}.at', f'{direct}.de', f'{direct}.com']


def enrich_culture_data(
    culture_data: dict[str, Any],
    source_urls: list[str],
    mode: str = 'overwrite',
    target_fields: list[str] | None = None,
) -> tuple[dict[str, Any], list[str], dict[str, Any]]:
    """Search web, fetch readable text, then extract whitelisted enrichment fields."""
    effective_target_fields = target_fields or list(ENRICH_FIELD_WHITELIST)
    if not effective_target_fields:
        raise EnrichmentServiceError('NO_ENRICHABLE_FIELDS')

    max_results = int(os.getenv('ENRICH_MAX_SEARCH_RESULTS', '8'))
    max_urls = int(os.getenv('ENRICH_MAX_FETCH_URLS', '5'))
    supplier = str(culture_data.get('seed_supplier', '')).strip()
    query = f"{culture_data.get('name', '')} {culture_data.get('variety', '')} {supplier} cultivation data"

    supplier_domains = _domains_for_supplier(supplier)
    search_results = web_search(query=query.strip(), max_results=max_results, include_domains=supplier_domains or None)

    dedup_urls: list[str] = []
    for result in search_results:
        url = result['url']
        if url not in dedup_urls:
            dedup_urls.append(url)

    selected_urls = dedup_urls[:max_urls]
    docs: list[dict[str, str]] = []
    fetched_urls: list[str] = []
    for result in search_results:
        url = result['url']
        if url not in selected_urls:
            continue
        text = fetch_page_text(url)
        if not text:
            continue
        docs.append({'url': url, 'title': result.get('title', ''), 'snippet': result.get('snippet', ''), 'text': text})
        fetched_urls.append(url)

    if not fetched_urls:
        import sys
        print(f'[ENRICH DEBUG] NO_SOURCES - search returned {len(search_results)} results but none fetchable', file=sys.stderr)
        raise EnrichmentServiceError('NO_SOURCES')

    parsed = _call_llm_extract(culture_data, docs, mode=mode, target_fields=effective_target_fields)

    llm_sources = parsed.get('sources', [])
    if not isinstance(llm_sources, list):
        llm_sources = []

    normalized_sources: list[str] = []
    for url in [*llm_sources, *fetched_urls, *source_urls]:
        normalized = str(url).strip()
        if normalized and normalized not in normalized_sources:
            normalized_sources.append(normalized)

    updates: dict[str, Any] = {}
    for field in ENRICH_FIELD_WHITELIST:
        if field in parsed and field in effective_target_fields:
            updates[field] = parsed[field]

    notes = updates.get('notes')
    if notes is not None:
        updates['notes'] = str(notes).replace('\r', ' ').replace('\n', ' ').strip()

    if not updates:
        import sys
        print(f'[ENRICH DEBUG] NO_ENRICHABLE_FIELDS - parsed keys: {list(parsed.keys())}, target fields: {effective_target_fields}', file=sys.stderr)
        raise EnrichmentServiceError('NO_ENRICHABLE_FIELDS')

    debug = {
        'mode': mode,
        'target_fields': effective_target_fields,
        'search_query': query.strip(),
        'search_results_count': len(search_results),
        'fetched_urls_count': len(fetched_urls),
        'parsed_keys': list(parsed.keys()),
        'returned_update_keys': list(updates.keys()),
        'returned_sources_count': len(normalized_sources),
        'supplier_domains': supplier_domains,
    }

    return updates, normalized_sources, debug
