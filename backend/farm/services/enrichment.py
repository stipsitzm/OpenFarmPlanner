"""Culture enrichment service with web search + page extraction + LLM extraction."""

from __future__ import annotations

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

SPECIES_RULES: dict[str, dict[str, Any]] = {
    'kohlrabi': {
        'family': 'Brassicaceae',
        'genus': 'Brassica',
        'growth_range_days': (45, 95),
        'typical_density_per_m2': (8.0, 25.0),
        'transplanted': True,
    },
    'tomato': {
        'family': 'Solanaceae',
        'genus': 'Solanum',
        'growth_range_days': (60, 140),
        'typical_density_per_m2': (2.0, 5.0),
        'transplanted': True,
    },
}


def _build_system_prompt() -> str:
    return (
        'You are an agronomy research assistant for vegetable cultivation data. '
        'Return ONLY valid JSON without markdown. '
        'Use conservative values, avoid guessing. '
        'Only output allowed fields. '
        'The notes field must be detailed markdown in German language, '
        'and must NOT contain a Quellen section. '
        'Distinguish genus and family correctly (e.g., Brassica vs Brassicaceae). '
        'Do not mix data from different varieties/cultivars. '
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


def _infer_species_rule(culture_name: str) -> dict[str, Any] | None:
    lowered = culture_name.strip().lower()
    for key, rule in SPECIES_RULES.items():
        if key in lowered:
            return rule
    return None


def _value_as_float(value: Any) -> float | None:
    try:
        if value is None or value == '':
            return None
        return float(value)
    except (ValueError, TypeError):
        return None


def _value_as_int(value: Any) -> int | None:
    try:
        if value is None or value == '':
            return None
        return int(value)
    except (ValueError, TypeError):
        return None


def _collect_plausibility_warnings(
    culture_data: dict[str, Any],
    updates: dict[str, Any],
    docs: list[dict[str, str]],
    normalized_sources: list[str],
) -> list[str]:
    warnings: list[str] = []
    name = str(culture_data.get('name', '')).strip()
    rule = _infer_species_rule(name)

    # Taxonomy checks: family vs genus and known family for mapped species.
    crop_family = str(updates.get('crop_family') or culture_data.get('crop_family') or '').strip()
    if crop_family and not crop_family.lower().endswith('aceae'):
        warnings.append('Taxonomy plausibility: crop_family should usually be a botanical family (e.g. Brassicaceae, not Brassica).')
    if rule and crop_family and rule['family'].lower() not in crop_family.lower():
        warnings.append(f"Taxonomy mismatch: expected family around '{rule['family']}' for {name}.")

    # Growth duration plausibility against species range.
    growth_days = _value_as_int(updates.get('growth_duration_days', culture_data.get('growth_duration_days')))
    if rule and growth_days is not None:
        lo, hi = rule['growth_range_days']
        if growth_days < lo or growth_days > hi:
            warnings.append(
                f'Growth duration plausibility: {growth_days}d outside typical range {lo}-{hi}d for {name}.'
            )

    # Harvest duration cannot dominate maturity unrealistically.
    harvest_days = _value_as_int(updates.get('harvest_duration_days', culture_data.get('harvest_duration_days')))
    if growth_days is not None and harvest_days is not None and harvest_days > max(14, int(growth_days * 1.5)):
        warnings.append(
            f'Biological plausibility: harvest_duration_days ({harvest_days}) too high compared to growth_duration_days ({growth_days}).'
        )

    # Seed rate plausibility (g/m2 + TKG => seeds/m2) compared to expected density.
    seed_rate_value = _value_as_float(updates.get('seed_rate_value', culture_data.get('seed_rate_value')))
    seed_rate_unit = str(updates.get('seed_rate_unit', culture_data.get('seed_rate_unit')) or '').strip().lower()
    tkg = _value_as_float(updates.get('thousand_kernel_weight_g', culture_data.get('thousand_kernel_weight_g')))

    if seed_rate_value is not None and seed_rate_unit in {'g_per_m2', 'g/m²', 'g/m2'} and tkg and tkg > 0:
        seeds_per_m2 = (seed_rate_value * 1000.0) / tkg
        if rule:
            d_lo, d_hi = rule['typical_density_per_m2']
            median_density = (d_lo + d_hi) / 2.0
            if median_density > 0:
                factor = max(seeds_per_m2 / median_density, median_density / seeds_per_m2)
                if factor > 3.0:
                    warnings.append(
                        f'Seed rate plausibility: estimated {seeds_per_m2:.1f} seeds/m² deviates by factor {factor:.1f} from typical density.'
                    )

    # Source consistency for variety/cultivar.
    variety = str(culture_data.get('variety', '')).strip().lower()
    if variety and len(docs) > 1:
        with_variety = 0
        for doc in docs:
            haystack = ' '.join([
                str(doc.get('title', '')),
                str(doc.get('snippet', '')),
                str(doc.get('text', ''))[:1200],
            ]).lower()
            if variety in haystack:
                with_variety += 1
        if 0 < with_variety < len(docs):
            warnings.append('Source consistency: not all sources clearly reference the same variety/cultivar.')

    if len(normalized_sources) > 3:
        warnings.append('Source consistency: many sources used; verify data refers to one cultivar only.')

    return warnings


def _compute_confidence_score(warnings: list[str], source_count: int, update_count: int) -> float:
    score = 0.55
    score += min(0.25, source_count * 0.05)
    score += min(0.20, update_count * 0.03)
    score -= min(0.60, len(warnings) * 0.12)
    return round(max(0.0, min(1.0, score)), 2)


def web_search(query: str, max_results: int = 8, include_domains: list[str] | None = None) -> list[dict[str, str]]:
    """Run Tavily search and return simplified results list."""
    api_key = os.getenv('TAVILY_API_KEY', '').strip()
    if not api_key:
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
        raise EnrichmentServiceError('Web search request failed.') from exc

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
    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if not api_key:
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
            'constraints': {
                'single_line_notes': False,
                'notes_without_quellen': True,
                'notes_language': 'de',
                'taxonomy_family_not_genus': True,
                'variety_consistency': True,
            },
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
        raise EnrichmentServiceError('LLM request failed.') from exc

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
        raise EnrichmentServiceError('NO_SOURCES')

    parsed = _call_llm_extract(culture_data, docs, mode=mode, target_fields=effective_target_fields)

    llm_sources = parsed.get('sources', [])
    if not isinstance(llm_sources, list):
        llm_sources = []

    normalized_sources: list[str] = []
    for url in [*llm_sources, *fetched_urls]:
        normalized = str(url).strip()
        if normalized and normalized not in normalized_sources:
            normalized_sources.append(normalized)

    updates: dict[str, Any] = {}
    for field in ENRICH_FIELD_WHITELIST:
        if field in parsed and field in effective_target_fields:
            updates[field] = parsed[field]

    notes = updates.get('notes')
    if notes is not None:
        updates['notes'] = str(notes).replace('\r\n', '\n').replace('\r', '\n').strip()

    warnings = _collect_plausibility_warnings(culture_data, updates, docs, normalized_sources)
    confidence_score = _compute_confidence_score(warnings, len(normalized_sources), len(updates))

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
        'plausibility_warnings': warnings,
        'confidence_score': confidence_score,
    }

    return updates, normalized_sources, debug
