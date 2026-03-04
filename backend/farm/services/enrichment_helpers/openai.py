"""OpenAI Responses provider helper functions for enrichment."""

from __future__ import annotations

import json
import re
from typing import Any, Callable

import requests


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
    extract_usage: Callable[[dict[str, Any]], dict[str, int]],
    count_web_search_calls: Callable[[dict[str, Any]], int],
) -> tuple[dict[str, Any], dict[str, int], int]:
    """Execute one Responses API call and return parsed payload with usage metadata."""
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
                "tools": [{
                    "type": "web_search_preview",
                    "user_location": {"type": "approximate", "country": "AT"},
                }],
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
    usage = extract_usage(payload)
    web_search_call_count = count_web_search_calls(payload)
    return parsed, usage, web_search_call_count


def merge_phase_payloads(base: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    """Merge two provider payloads without changing the output contract."""
    merged = dict(base)

    base_suggested_fields = base.get('suggested_fields')
    fallback_suggested_fields = fallback.get('suggested_fields')
    if isinstance(base_suggested_fields, dict) and isinstance(fallback_suggested_fields, dict):
        merged['suggested_fields'] = {**fallback_suggested_fields, **base_suggested_fields}
    elif base_suggested_fields not in (None, {}):
        merged['suggested_fields'] = base_suggested_fields
    else:
        merged['suggested_fields'] = fallback_suggested_fields if fallback_suggested_fields is not None else {}

    base_evidence = base.get('evidence') if isinstance(base.get('evidence'), dict) else {}
    fallback_evidence = fallback.get('evidence') if isinstance(fallback.get('evidence'), dict) else {}
    merged_evidence: dict[str, Any] = {}
    for field in set(base_evidence) | set(fallback_evidence):
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
    merged['validation'] = {
        'warnings': (base_validation.get('warnings') or []) + (fallback_validation.get('warnings') or []),
        'errors': (base_validation.get('errors') or []) + (fallback_validation.get('errors') or []),
    }

    if not merged.get('note_blocks') and fallback.get('note_blocks'):
        merged['note_blocks'] = fallback.get('note_blocks')
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

    return {
        **payload,
        'suggested_fields': filtered_suggested,
        'evidence': filtered_evidence,
        'validation': validation,
    }
