"""Post-processing helpers for enrichment payloads."""

from __future__ import annotations

import re
from typing import Any, Callable


def normalize_suggested_fields_payload(
    payload: object,
    validation: dict[str, Any],
    coerce_text_value: Callable[[object, str], str],
) -> dict[str, Any]:
    """Normalize suggested_fields payload to mapping form without raising hard errors."""
    warnings = validation.setdefault('warnings', [])
    if isinstance(payload, dict):
        return payload

    if isinstance(payload, list):
        normalized: dict[str, Any] = {}
        for item in payload:
            if not isinstance(item, dict):
                continue
            field_name = coerce_text_value(item.get('field'), 'suggested_fields.field').strip()
            if not field_name:
                continue
            normalized[field_name] = {
                'value': item.get('value'),
                'unit': item.get('unit'),
                'confidence': item.get('confidence', 0.6),
            }
        if isinstance(warnings, list):
            warnings.append({
                'field': 'suggested_fields',
                'code': 'suggested_fields_list_normalized',
                'message': 'Normalized suggested_fields list payload into mapping format.',
            })
        return normalized

    if isinstance(warnings, list):
        warnings.append({
            'field': 'suggested_fields',
            'code': 'invalid_suggested_fields_payload',
            'message': 'Invalid suggested_fields payload type; treating as empty mapping.',
        })
    return {}


def validate_seed_package_suggestions(suggested_fields: dict[str, Any], evidence: dict[str, Any], validation: dict[str, Any]) -> None:
    """Normalize and validate seed package entries while preserving output schema."""
    payload = suggested_fields.get('seed_packages')
    if payload is None:
        return

    suggestions = payload.get('value') if isinstance(payload, dict) else payload
    if not isinstance(suggestions, list):
        suggested_fields.pop('seed_packages', None)
        return

    accepted: list[dict[str, Any]] = []
    warnings = validation.setdefault('warnings', [])
    payload_unit = str(payload.get('unit') or '').strip().lower() if isinstance(payload, dict) else ''

    def parse_suggestion(item: Any) -> dict[str, Any] | None:
        if isinstance(item, dict):
            try:
                size_value = float(item.get('size_value'))
            except (TypeError, ValueError):
                return None
            size_unit = str(item.get('size_unit') or '').strip().lower()
            if size_unit != 'g':
                return None
            evidence_text = str(item.get('evidence_text') or '')
            return {
                'package_type': 'weight_g',
                'size_value': size_value,
                'size_unit': 'g',
                'raw_text': str(item.get('raw_text') or f'{size_value} g'),
                'evidence_text': evidence_text,
            }

        if isinstance(item, (int, float)) and payload_unit == 'g':
            size_value = float(item)
            return {
                'package_type': 'weight_g',
                'size_value': size_value,
                'size_unit': 'g',
                'raw_text': f'{size_value} g',
                'evidence_text': '',
            }

        if isinstance(item, str):
            raw_text = item.strip()
            if not raw_text:
                return None

            weight_match = re.search(r'(\d+(?:[\.,]\d+)?)\s*g\b', raw_text, flags=re.IGNORECASE)
            if weight_match:
                return {
                    'package_type': 'weight_g',
                    'size_value': float(weight_match.group(1).replace(',', '.')),
                    'size_unit': 'g',
                    'raw_text': raw_text,
                    'evidence_text': '',
                }

            count_match = re.search(r'(\d+)\s*[kK]\b', raw_text)
            if count_match:
                return {
                    'package_type': 'count_seeds',
                    'count_value': int(count_match.group(1)),
                    'count_unit': 'K',
                    'raw_text': raw_text,
                    'evidence_text': '',
                }

            return {
                'package_type': 'raw_text',
                'raw_text': raw_text,
                'evidence_text': '',
            }

        return None

    for item in suggestions:
        parsed = parse_suggestion(item)
        if not parsed:
            continue

        package_type = parsed.get('package_type')
        evidence_text = str(parsed.get('evidence_text') or '')

        if package_type == 'weight_g':
            size_value = float(parsed.get('size_value') or 0)
            if size_value <= 0 or size_value < 0.1 or size_value > 1000:
                continue
            decimals = str(size_value).split('.')
            if len(decimals) > 1 and len(decimals[1].rstrip('0')) >= 3 and '0.195 g' not in evidence_text:
                if isinstance(warnings, list):
                    warnings.append({
                        'field': 'seed_packages',
                        'code': 'seed_package_fractional_suspicious',
                        'message': 'Looks like per-seed mass, not a sold pack size.',
                    })
                continue
            accepted.append({
                'package_type': 'weight_g',
                'size_value': size_value,
                'size_unit': 'g',
                'raw_text': str(parsed.get('raw_text') or f'{size_value} g'),
                'evidence_text': evidence_text[:200],
            })
            continue

        if package_type == 'count_seeds':
            count_value = int(parsed.get('count_value') or 0)
            if count_value <= 0:
                continue
            accepted.append({
                'package_type': 'count_seeds',
                'count_value': count_value,
                'count_unit': 'K',
                'raw_text': str(parsed.get('raw_text') or f'{count_value} K'),
                'evidence_text': evidence_text[:200],
            })
            continue

        if isinstance(warnings, list):
            warnings.append({
                'field': 'seed_packages',
                'code': 'seed_package_unparsed_retained',
                'message': 'Retained unparsed package option as raw text.',
            })
        accepted.append({
            'package_type': 'raw_text',
            'raw_text': str(parsed.get('raw_text') or ''),
            'evidence_text': evidence_text[:200],
        })

    raw_confidence = payload.get('confidence', 0.6) if isinstance(payload, dict) else 0.6
    try:
        confidence = float(raw_confidence)
    except (TypeError, ValueError):
        confidence = 0.6
    suggested_fields['seed_packages'] = {'value': accepted, 'unit': None, 'confidence': max(0.0, min(1.0, confidence))}


def normalize_suggested_field_values(
    suggested_fields: dict[str, Any],
    validation: dict[str, Any],
    numeric_fields: tuple[str, ...],
    normalize_numeric_field: Callable[[object], float | None],
    coerce_text_value: Callable[[object, str], str],
) -> None:
    """Normalize value formats for numeric fields while preserving response schema."""
    warnings = validation.setdefault('warnings', [])
    range_note_lines: list[str] = []

    confidence_aliases = {'low': 0.3, 'medium': 0.6, 'high': 0.9}
    for suggestion in suggested_fields.values():
        if not isinstance(suggestion, dict):
            continue
        raw_confidence = suggestion.get('confidence', 0.0)
        if isinstance(raw_confidence, str):
            mapped = confidence_aliases.get(raw_confidence.strip().lower())
            if mapped is not None:
                suggestion['confidence'] = mapped
                continue
        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError):
            confidence = 0.0
        suggestion['confidence'] = max(0.0, min(1.0, confidence))

    for field_name, suggestion in suggested_fields.items():
        if not isinstance(suggestion, dict) or field_name not in numeric_fields:
            continue

        raw_value = suggestion.get('value')
        if isinstance(raw_value, str) and ('-' in raw_value or '–' in raw_value):
            normalized_range_value = normalize_numeric_field(raw_value)
            if normalized_range_value is None:
                suggestion['value'] = None
                if isinstance(warnings, list):
                    warnings.append({
                        'field': field_name,
                        'code': 'unparseable_numeric',
                        'message': f"Could not parse numeric value '{raw_value}'. Set value to null.",
                    })
            else:
                suggestion['value'] = normalized_range_value
                if isinstance(warnings, list):
                    warnings.append({
                        'field': field_name,
                        'code': 'range_collapsed_to_mean',
                        'message': f"Normalized range string '{raw_value}' to mean value {normalized_range_value}.",
                    })
                range_note_lines.append(
                    f"- {field_name}: Bereichsangabe '{raw_value}' wurde auf den Mittelwert {normalized_range_value} umgerechnet."
                )
            continue

        normalized_numeric = normalize_numeric_field(raw_value)
        if normalized_numeric is None:
            if isinstance(raw_value, str):
                suggestion['value'] = None
                if isinstance(warnings, list):
                    warnings.append({
                        'field': field_name,
                        'code': 'unparseable_numeric',
                        'message': f"Could not parse numeric value '{raw_value}'. Set value to null.",
                    })
            continue
        suggestion['value'] = normalized_numeric

    for suggestion in suggested_fields.values():
        if isinstance(suggestion, dict) and suggestion.get('unit') == '':
            suggestion['unit'] = None

    seed_rate = suggested_fields.get('seed_rate_value')
    if isinstance(seed_rate, dict):
        raw_value = seed_rate.get('value')
        if isinstance(raw_value, str):
            has_method_context = bool(re.search(r'\bdirektsaat\b|\bpflanzung\b|\banzucht\b|\bpre\s*cultivation\b|\bdirect\s*sowing\b|\btransplant', raw_value, flags=re.IGNORECASE))
            if not has_method_context:
                number_match = re.search(r'-?\d+(?:[\.,]\d+)?', raw_value)
                if number_match:
                    seed_rate['value'] = float(number_match.group(0).replace(',', '.'))
                    if isinstance(warnings, list):
                        warnings.append({
                            'field': 'seed_rate_value',
                            'code': 'seed_rate_value_unit_removed',
                            'message': 'Removed embedded unit from seed_rate_value; use seed_rate_unit for units.',
                        })
    if range_note_lines:
        note_block = "## Dauerwerte\n" + "\n".join(range_note_lines)
        notes = suggested_fields.get('notes')
        if isinstance(notes, dict):
            existing = coerce_text_value(notes.get('value', ''), 'notes')
            notes['value'] = f"{existing}\n\n{note_block}".strip() if note_block not in existing else existing
        else:
            suggested_fields['notes'] = {'value': note_block, 'unit': None, 'confidence': 0.5}



def cleanup_validation_warnings(validation: dict[str, Any], suggested_fields: dict[str, Any]) -> None:
    """Deduplicate warnings and drop stale supplier-only drop warnings."""
    warnings = validation.setdefault('warnings', [])
    if not isinstance(warnings, list):
        return

    cleaned_warnings: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for warning in warnings:
        if not isinstance(warning, dict):
            continue
        code = str(warning.get('code') or '')
        field = str(warning.get('field') or '')

        if code == 'supplier_only_non_supplier_suggestion_dropped' and field in suggested_fields:
            continue

        dedupe_key = (field, code)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        cleaned_warnings.append(warning)

    validation['warnings'] = cleaned_warnings
