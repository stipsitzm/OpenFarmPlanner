"""OpenAI Responses provider helper functions for enrichment."""

from __future__ import annotations

import json
import re
from typing import Any, Callable

import requests


def _extract_raw_tool_sources_from_evidence(evidence: object) -> list[dict[str, str]]:
    """Extract unique source URLs from evidence entries for tracing."""
    if not isinstance(evidence, dict):
        return []
    seen: set[str] = set()
    sources: list[dict[str, str]] = []
    for field_name, entries in evidence.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            source_url = str(entry.get('source_url') or '').strip()
            if not source_url or source_url in seen:
                continue
            seen.add(source_url)
            sources.append({'source_url': source_url, 'field': str(field_name)})
    return sources




def _extract_raw_tool_sources_from_provider_payload(payload: dict[str, Any]) -> list[dict[str, str]]:
    """Best-effort extraction of URLs from raw provider payload for audit filtering."""
    seen: set[str] = set()
    urls: list[dict[str, str]] = []
    for item in payload.get('output', []) or []:
        if not isinstance(item, dict):
            continue
        blob = json.dumps(item, ensure_ascii=False, sort_keys=True)
        for url in re.findall(r"https?://[^\s\"'\\]\)>,]+", blob):
            if url in seen:
                continue
            seen.add(url)
            urls.append({'source_url': url, 'field': 'tool_output'})
    return urls




def _merge_allowed_sowing_methods(base_value: Any, fallback_value: Any) -> list[str]:
    """Merge allowed_sowing_methods lists while preserving supplier-first order."""
    merged: list[str] = []
    for candidate in [base_value, fallback_value]:
        if not isinstance(candidate, list):
            continue
        for item in candidate:
            if not isinstance(item, str):
                continue
            value = item.strip()
            if value and value not in merged:
                merged.append(value)
    return merged


def extract_text_payload(payload: dict[str, Any]) -> str:
    """Extract model text from Responses API payload across schema variants."""
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    parts: list[str] = []
    for item in payload.get("output", []) or []:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "message":
            for content in item.get("content", []) or []:
                if not isinstance(content, dict):
                    continue
                text = content.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())

    combined = "\n".join(parts).strip()
    if combined:
        return combined

    raise ValueError("Provider returned no text content")


def parse_json_block(text: str) -> dict[str, Any]:
    """Parse JSON from text, including fenced code blocks and mixed prose."""

    def _try_json(candidate: str) -> dict[str, Any] | None:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    direct = _try_json(text.strip())
    if direct is not None:
        return direct

    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fenced:
        fenced_payload = _try_json(fenced.group(1).strip())
        if fenced_payload is not None:
            return fenced_payload

    decoder = json.JSONDecoder()
    for match in re.finditer(r"[\{\[]", text):
        start = match.start()
        try:
            parsed, _ = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    raise ValueError(f"Provider returned non-JSON payload: {text[:400]}")


def request_enrichment_payload(
    *,
    api_key: str,
    responses_url: str,
    request_timeout: tuple[float, float],
    prompt: str,
    model_name: str,
    allowed_domains: list[str] | None,
    extract_usage: Callable[[dict[str, Any]], dict[str, int]],
    count_web_search_calls: Callable[[dict[str, Any]], int],
) -> tuple[dict[str, Any], dict[str, int], int]:
    """Execute one Responses API call and return parsed payload with usage metadata."""
    web_search_tool: dict[str, Any] = {
        "type": "web_search",
        "user_location": {"type": "approximate", "country": "AT"},
    }
    if allowed_domains:
        web_search_tool["filters"] = {"allowed_domains": allowed_domains}

    try:
        response = requests.post(
            responses_url,
            timeout=request_timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model_name,
                "tools": [web_search_tool],
                "input": prompt,
            },
        )
    except requests.RequestException as exc:
        raise ValueError(f"OpenAI request failed: {exc}") from exc

    if response.status_code >= 400:
        raise ValueError(f"OpenAI responses error: {response.status_code} {response.text[:300]}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise ValueError("OpenAI response was not valid JSON") from exc

    text = extract_text_payload(payload)
    parsed = parse_json_block(text)
    if isinstance(parsed, dict):
        trace = parsed.get('source_trace') if isinstance(parsed.get('source_trace'), dict) else {}
        raw_sources = _extract_raw_tool_sources_from_provider_payload(payload)
        raw_sources.extend(_extract_raw_tool_sources_from_evidence(parsed.get('evidence')))
        dedup: dict[str, dict[str, str]] = {}
        for source in raw_sources:
            source_url = str(source.get('source_url') or '').strip()
            if source_url:
                dedup[source_url] = {'source_url': source_url, 'field': str(source.get('field') or '*')}
        trace['raw_tool_sources'] = list(dedup.values())
        parsed['source_trace'] = trace
    usage = extract_usage(payload)
    web_search_call_count = count_web_search_calls(payload)
    return parsed, usage, web_search_call_count


def merge_phase_payloads(base: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    """Merge two provider payloads without changing the output contract."""
    merged = dict(base)

    base_suggested_fields = base.get('suggested_fields')
    fallback_suggested_fields = fallback.get('suggested_fields')
    if isinstance(base_suggested_fields, dict) and isinstance(fallback_suggested_fields, dict):
        merged_suggested = {**fallback_suggested_fields, **base_suggested_fields}
        base_methods = base_suggested_fields.get('allowed_sowing_methods') if isinstance(base_suggested_fields.get('allowed_sowing_methods'), dict) else None
        fallback_methods = fallback_suggested_fields.get('allowed_sowing_methods') if isinstance(fallback_suggested_fields.get('allowed_sowing_methods'), dict) else None
        if base_methods and fallback_methods:
            merged_values = _merge_allowed_sowing_methods(base_methods.get('value'), fallback_methods.get('value'))
            if merged_values:
                merged_suggested['allowed_sowing_methods'] = {
                    **base_methods,
                    'value': merged_values,
                    'confidence': max(float(base_methods.get('confidence') or 0), float(fallback_methods.get('confidence') or 0)),
                }
        merged['suggested_fields'] = merged_suggested
    elif base_suggested_fields not in (None, {}):
        merged['suggested_fields'] = base_suggested_fields
    else:
        merged['suggested_fields'] = fallback_suggested_fields if fallback_suggested_fields is not None else {}

    base_evidence = base.get('evidence') if isinstance(base.get('evidence'), dict) else {}
    fallback_evidence = fallback.get('evidence') if isinstance(fallback.get('evidence'), dict) else {}
    base_field_keys = set(base_suggested_fields.keys()) if isinstance(base_suggested_fields, dict) else set()
    merged_evidence: dict[str, Any] = {}
    for field in set(base_evidence) | set(fallback_evidence):
        if field in base_field_keys:
            merged_evidence[field] = base_evidence.get(field) if isinstance(base_evidence.get(field), list) else []
            continue

        combined_entries: list[Any] = []
        seen_keys: set[str] = set()
        for entries in [base_evidence.get(field), fallback_evidence.get(field)]:
            if not isinstance(entries, list):
                continue
            for entry in entries:
                key = json.dumps(entry, sort_keys=True, ensure_ascii=False) if isinstance(entry, dict) else str(entry)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                combined_entries.append(entry)
        merged_evidence[field] = combined_entries
    merged['evidence'] = merged_evidence

    base_validation = base.get('validation') if isinstance(base.get('validation'), dict) else {}
    fallback_validation = fallback.get('validation') if isinstance(fallback.get('validation'), dict) else {}
    merged_warnings = (base_validation.get('warnings') or []) + (fallback_validation.get('warnings') or [])
    if isinstance(base_suggested_fields, dict) and 'seed_packages' in base_suggested_fields:
        filtered_warnings: list[Any] = []
        for warning in merged_warnings:
            if not isinstance(warning, dict):
                filtered_warnings.append(warning)
                continue
            code = str(warning.get('code') or '')
            field = str(warning.get('field') or '')
            if field == 'seed_packages' and code in {'missing_supplier_evidence', 'seed_packages_require_supplier_evidence'}:
                continue
            filtered_warnings.append(warning)
        merged_warnings = filtered_warnings

    merged['validation'] = {
        'warnings': merged_warnings,
        'errors': (base_validation.get('errors') or []) + (fallback_validation.get('errors') or []),
    }

    base_notes = str(base.get('note_blocks') or '').strip()
    fallback_notes = str(fallback.get('note_blocks') or '').strip()
    if base_notes and fallback_notes:
        merged['note_blocks'] = (
            '## Supplier-Phase Hinweise\n' + base_notes + '\n\n'
            '## External-Phase Hinweise\n' + fallback_notes
        )
    elif base_notes:
        merged['note_blocks'] = base_notes
    elif fallback_notes:
        merged['note_blocks'] = fallback_notes

    merged_field_origins: dict[str, str] = {}
    merged_suggested_fields = merged.get('suggested_fields') if isinstance(merged.get('suggested_fields'), dict) else {}
    base_keys = set(base_suggested_fields.keys()) if isinstance(base_suggested_fields, dict) else set()
    fallback_keys = set(fallback_suggested_fields.keys()) if isinstance(fallback_suggested_fields, dict) else set()
    for key in merged_suggested_fields.keys():
        in_base = key in base_keys
        in_fallback = key in fallback_keys
        if in_base and in_fallback:
            merged_field_origins[key] = 'mixed' if key == 'allowed_sowing_methods' else 'supplier_phase'
        elif in_base:
            merged_field_origins[key] = 'supplier_phase'
        elif in_fallback:
            merged_field_origins[key] = 'external_phase'

    merged['source_trace'] = {
        'field_origins': merged_field_origins,
        'phase_1': base.get('source_trace') if isinstance(base.get('source_trace'), dict) else {
            'raw_tool_sources': _extract_raw_tool_sources_from_evidence(base.get('evidence')),
            'accepted_sources': _extract_raw_tool_sources_from_evidence(base.get('evidence')),
            'rejected_sources': [],
            'rejection_reason': [],
        },
        'phase_2': fallback.get('source_trace') if isinstance(fallback.get('source_trace'), dict) else {
            'raw_tool_sources': _extract_raw_tool_sources_from_evidence(fallback.get('evidence')),
            'accepted_sources': _extract_raw_tool_sources_from_evidence(fallback.get('evidence')),
            'rejected_sources': [],
            'rejection_reason': [],
        },
    }
    return merged


def has_supplier_specific_evidence(
    supplier_name: str,
    evidence: object,
    is_supplier_matching_evidence: Callable[[str, object], bool],
) -> bool:
    """Return True when any evidence entry references the configured supplier."""
    if not isinstance(evidence, dict):
        return False
    return any(is_supplier_matching_evidence(supplier_name, entries) for entries in evidence.values())


def apply_supplier_only_filter(
    payload: dict[str, Any],
    culture: Any,
    supplier_domains_for_culture: Callable[[Any], set[str]],
    is_supplier_entry: Callable[[dict[str, Any], str, set[str]], bool],
    is_plausible_supplier_source_url: Callable[[str, str], bool],
) -> dict[str, Any]:
    """Filter provider payload to strict supplier evidence for seed packages only."""
    supplier_name = culture.supplier.name if culture.supplier else (culture.seed_supplier or '')
    supplier_domains = supplier_domains_for_culture(culture)
    evidence = payload.get('evidence') if isinstance(payload.get('evidence'), dict) else {}
    raw_suggested_fields = payload.get('suggested_fields')
    suggested_fields = raw_suggested_fields if isinstance(raw_suggested_fields, dict) else raw_suggested_fields
    validation = payload.get('validation') if isinstance(payload.get('validation'), dict) else {'warnings': [], 'errors': []}
    warnings = validation.setdefault('warnings', [])

    filtered_evidence: dict[str, list[dict[str, Any]]] = {}
    for field_name, entries in evidence.items():
        if not isinstance(entries, list):
            continue
        kept: list[dict[str, Any]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if is_supplier_entry(entry, supplier_name, supplier_domains):
                source_url = str(entry.get('source_url') or '').strip()
                if source_url and not is_plausible_supplier_source_url(source_url, str(culture.name or '')):
                    continue
                entry = dict(entry)
                entry['supplier_specific'] = True
                kept.append(entry)
        if kept:
            filtered_evidence[field_name] = kept

    filtered_suggested: Any = suggested_fields
    if isinstance(filtered_suggested, dict):
        for field_name in list(filtered_suggested.keys()):
            if field_name == 'notes':
                continue
            if field_name == 'seed_packages' and not filtered_evidence.get(field_name):
                filtered_suggested.pop(field_name, None)
                if isinstance(warnings, list):
                    warnings.append({
                        'field': field_name,
                        'code': 'supplier_only_non_supplier_suggestion_dropped',
                        'message': f"Dropped suggestion for {field_name} in supplier-only phase because supplier evidence is missing.",
                    })

    raw_sources = _extract_raw_tool_sources_from_evidence(evidence)
    accepted_sources = _extract_raw_tool_sources_from_evidence(filtered_evidence)
    rejected_urls = {item['source_url'] for item in raw_sources} - {item['source_url'] for item in accepted_sources}
    rejected_sources = [
        {'source_url': url, 'field': '*', 'rejection_reason': 'not_in_allowlist'}
        for url in sorted(rejected_urls)
    ]

    return {
        **payload,
        'suggested_fields': filtered_suggested,
        'evidence': filtered_evidence,
        'validation': validation,
        'source_trace': {
            'raw_tool_sources': raw_sources,
            'accepted_sources': accepted_sources,
            'rejected_sources': rejected_sources,
            'rejection_reason': sorted({item['rejection_reason'] for item in rejected_sources}),
        },
    }
