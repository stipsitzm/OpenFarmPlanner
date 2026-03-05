"""Sowing method normalization helpers for enrichment output."""

from __future__ import annotations

import re
from typing import Any, Callable

from farm.models import Culture


def normalize_sowing_method_enrichment_fields(
    culture: Culture,
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    validation: dict[str, Any],
    normalize_choice_value: Callable[[str, object], object],
    coerce_text_value: Callable[[object, str], str],
    numeric_field_normalizer: Callable[[object], float | None],
) -> None:
    """Normalize sowing-method suggestions and replace legacy single seed-rate fields."""
    warnings = validation.setdefault('warnings', [])

    def _method_from_text(text: str) -> list[str]:
        normalized_text = text.lower()
        parsed: list[str] = []
        if re.search(r'\bdirektsaat\b|\bdirect\s*sowing\b', normalized_text):
            parsed.append('direct_sowing')
        if re.search(r'\bpflanzung\b|\banzucht\b|\bpre\s*cultivation\b|\btransplant', normalized_text):
            parsed.append('pre_cultivation')
        return parsed

    def parse_methods(value: object) -> list[str]:
        parsed: list[str] = []
        candidates: list[object]
        if isinstance(value, list):
            candidates = value
        elif isinstance(value, str):
            candidates = [item.strip() for item in re.split(r'[,;]', value) if item.strip()]
        else:
            candidates = [value]

        for item in candidates:
            if isinstance(item, str):
                for method in _method_from_text(item):
                    if method not in parsed:
                        parsed.append(method)
            normalized = normalize_choice_value('cultivation_type', item)
            if normalized in {'pre_cultivation', 'direct_sowing'} and normalized not in parsed:
                parsed.append(normalized)
        return parsed

    def parse_method_rates_from_text(text: str) -> dict[str, tuple[float | None, str | None]]:
        parsed_rates: dict[str, tuple[float | None, str | None]] = {}
        if not text.strip():
            return parsed_rates

        pattern = re.compile(
            r'(?P<value>\d+(?:[\.,]\d+)?(?:\s*[\-–]\s*\d+(?:[\.,]\d+)?)?)\s*'
            r'(?P<unit>g\s*/\s*a|g/a|g\s*/\s*m²|g\s*/\s*m2|g\s*/\s*lfm|korn\s*/\s*pflanze|seeds\s*per\s*plant|seeds_per_plant)?'
            r'[^\n,;:.]*\b(?P<method>direktsaat|pflanzung|anzucht|pre\s*cultivation|direct\s*sowing|transplant(?:ing)?)\b',
            flags=re.IGNORECASE,
        )
        for match in pattern.finditer(text):
            method_raw = match.group('method')
            parsed_methods = _method_from_text(method_raw)
            if not parsed_methods:
                normalized = normalize_choice_value('cultivation_type', method_raw)
                parsed_methods = [normalized] if normalized in {'pre_cultivation', 'direct_sowing'} else []
            for method in parsed_methods:
                numeric = normalize_method_value(f'seed_rate_{method}_value', match.group('value'))
                normalized_unit, numeric = normalize_method_unit(
                    f'seed_rate_{method}_unit',
                    match.group('unit'),
                    numeric,
                )
                parsed_rates[method] = (numeric, normalized_unit)
        return parsed_rates

    def normalize_method_value(field_name: str, raw_value: object) -> float | None:
        if isinstance(raw_value, str) and ('-' in raw_value or '–' in raw_value):
            normalized = numeric_field_normalizer(raw_value)
            if normalized is not None and isinstance(warnings, list):
                warnings.append({
                    'field': field_name,
                    'code': 'range_collapsed_to_mean',
                    'message': f"Collapsed range '{raw_value}' to arithmetic mean {normalized}.",
                })
            return normalized
        return numeric_field_normalizer(raw_value)

    def normalize_method_unit(field_name: str, raw_unit: object, value: float | None) -> tuple[str | None, float | None]:
        if raw_unit is None:
            return None, value

        unit_text = coerce_text_value(raw_unit, field_name).strip().lower()
        if not unit_text:
            return None, value

        if unit_text in {'g/a', 'g per a', 'gramm pro ar', 'g je ar'}:
            converted_value = (value / 100.0) if value is not None else None
            if isinstance(warnings, list):
                warnings.append({
                    'field': field_name,
                    'code': 'seed_rate_unit_converted_from_g_per_are',
                    'message': 'Converted unit g/a to g_per_m2 by dividing value by 100.',
                })
            return 'g_per_m2', converted_value

        normalized_unit = normalize_choice_value('seed_rate_unit', unit_text)
        if normalized_unit in {'g_per_m2', 'g_per_lfm', 'seeds/m', 'seeds_per_plant'}:
            return str(normalized_unit), value
        return None, value

    allowed_methods: list[str] = []
    allowed_methods_suggestion = suggested_fields.get('allowed_sowing_methods')
    if isinstance(allowed_methods_suggestion, dict):
        allowed_methods = parse_methods(allowed_methods_suggestion.get('value'))

    cultivation_type_suggestion = suggested_fields.get('cultivation_type')
    if not allowed_methods and isinstance(cultivation_type_suggestion, dict):
        allowed_methods = parse_methods(cultivation_type_suggestion.get('value'))

    if not allowed_methods:
        allowed_methods = [item for item in (culture.cultivation_types or []) if item in {'pre_cultivation', 'direct_sowing'}]
    if not allowed_methods and culture.cultivation_type in {'pre_cultivation', 'direct_sowing'}:
        allowed_methods = [culture.cultivation_type]

    legacy_seed_rate_value = suggested_fields.get('seed_rate_value')
    legacy_seed_rate_unit = suggested_fields.get('seed_rate_unit')

    parsed_rates_from_text: dict[str, tuple[float | None, str | None]] = {}
    if isinstance(legacy_seed_rate_value, dict) and isinstance(legacy_seed_rate_value.get('value'), str):
        parsed_rates_from_text = parse_method_rates_from_text(str(legacy_seed_rate_value.get('value')))
        for parsed_method in parsed_rates_from_text:
            if parsed_method not in allowed_methods:
                allowed_methods.append(parsed_method)

    if not allowed_methods and (isinstance(legacy_seed_rate_value, dict) or isinstance(legacy_seed_rate_unit, dict)):
        allowed_methods = ['direct_sowing']

    if allowed_methods:
        confidence = 0.6
        if isinstance(allowed_methods_suggestion, dict):
            try:
                confidence = float(allowed_methods_suggestion.get('confidence', confidence))
            except (TypeError, ValueError):
                confidence = 0.6
        suggested_fields['allowed_sowing_methods'] = {'value': allowed_methods, 'unit': None, 'confidence': max(0.0, min(1.0, confidence))}

    method_definitions = [
        ('direct', 'direct_sowing', 'seed_rate_direct_value', 'seed_rate_direct_unit'),
        ('transplant', 'pre_cultivation', 'seed_rate_transplant_value', 'seed_rate_transplant_unit'),
    ]

    for _, method_key, value_field, legacy_unit_field in method_definitions:
        if method_key not in allowed_methods:
            continue

        value_payload = suggested_fields.get(value_field)

        if value_payload is None and isinstance(legacy_seed_rate_value, dict):
            value_payload = dict(legacy_seed_rate_value)
            suggested_fields[value_field] = value_payload
            if value_field not in evidence and isinstance(evidence.get('seed_rate_value'), list):
                evidence[value_field] = evidence.get('seed_rate_value')

        if isinstance(value_payload, dict) and not value_payload.get('unit') and isinstance(legacy_seed_rate_unit, dict):
            legacy_unit = legacy_seed_rate_unit.get('value')
            if isinstance(legacy_unit, str) and legacy_unit.strip():
                value_payload['unit'] = legacy_unit

        if isinstance(value_payload, dict) and not value_payload.get('unit'):
            unit_payload = suggested_fields.get(legacy_unit_field)
            if isinstance(unit_payload, dict):
                method_unit_value = unit_payload.get('value')
                if isinstance(method_unit_value, str) and method_unit_value.strip():
                    value_payload['unit'] = method_unit_value

        parsed_method_values = parsed_rates_from_text.get(method_key)
        if parsed_method_values:
            value_payload = value_payload if isinstance(value_payload, dict) else {'unit': None, 'confidence': 0.7}
            value_payload['value'] = parsed_method_values[0]
            suggested_fields[value_field] = value_payload

            if parsed_method_values[1] is not None:
                value_payload['unit'] = parsed_method_values[1]

        numeric_value: float | None = None
        if isinstance(value_payload, dict):
            numeric_value = normalize_method_value(value_field, value_payload.get('value'))
            value_payload['value'] = numeric_value

        if isinstance(value_payload, dict):
            normalized_unit, numeric_value = normalize_method_unit(f'{value_field}.unit', value_payload.get('unit'), numeric_value)
            value_payload['unit'] = normalized_unit
            value_payload['value'] = numeric_value

            if method_key == 'direct_sowing' and normalized_unit is None:
                if isinstance(warnings, list):
                    warnings.append({
                        'field': value_field,
                        'code': 'seed_rate_unit_missing_for_method_value',
                        'message': 'Method direct_sowing has value but missing explicit unit; entry skipped.',
                    })
                suggested_fields.pop(value_field, None)
                continue

            if method_key == 'direct_sowing' and normalized_unit not in {'g_per_m2', 'g_per_lfm'}:
                if isinstance(warnings, list):
                    warnings.append({
                        'field': value_field,
                        'code': 'seed_rate_unit_invalid_for_method',
                        'message': 'Method direct_sowing only accepts g_per_m2 or g_per_lfm; entry skipped.',
                    })
                suggested_fields.pop(value_field, None)
                continue

            if method_key == 'pre_cultivation' and normalized_unit is None:
                if isinstance(warnings, list):
                    warnings.append({
                        'field': value_field,
                        'code': 'seed_rate_unit_missing_for_method_value',
                        'message': 'Method pre_cultivation has value but missing explicit unit; entry skipped.',
                    })
                suggested_fields.pop(value_field, None)
                continue

            if method_key == 'pre_cultivation' and normalized_unit not in {'g_per_m2', 'g_per_lfm', 'seeds/m'}:
                if isinstance(warnings, list):
                    warnings.append({
                        'field': value_field,
                        'code': 'seed_rate_unit_invalid_for_method',
                        'message': 'Method pre_cultivation only accepts g_per_m2, g_per_lfm, or seeds/m; entry skipped.',
                    })
                suggested_fields.pop(value_field, None)
                continue

    # Keep enrichment output aligned with method-based sowing model.
    suggested_fields.pop('cultivation_type', None)
    suggested_fields.pop('seed_rate_value', None)
    suggested_fields.pop('seed_rate_unit', None)
    suggested_fields.pop('seed_rate_direct_unit', None)
    suggested_fields.pop('seed_rate_transplant_unit', None)


def apply_method_seed_rates_to_suggestions(
    suggested_fields: dict[str, Any],
    validation: dict[str, Any],
    normalize_choice_value: Callable[[str, object], object],
) -> None:
    """Build seed_rate_by_cultivation from method-specific enrichment fields."""
    warnings = validation.setdefault('warnings', [])

    method_specs = [
        ('direct_sowing', 'seed_rate_direct_value'),
        ('pre_cultivation', 'seed_rate_transplant_value'),
    ]

    method_seed_rates: dict[str, dict[str, Any]] = {}
    for method_key, value_field in method_specs:
        value_payload = suggested_fields.get(value_field)
        if not isinstance(value_payload, dict):
            continue

        raw_value = value_payload.get('value')
        try:
            parsed_value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if parsed_value <= 0:
            continue

        unit_value = None
        candidate = value_payload.get('unit')
        if isinstance(candidate, str) and candidate.strip():
            normalized = normalize_choice_value('seed_rate_unit', candidate.strip())
            if isinstance(normalized, str):
                unit_value = normalized

        if not unit_value:
            if isinstance(warnings, list):
                warnings.append({
                    'field': value_field,
                    'code': 'seed_rate_unit_missing_for_method_value',
                    'message': f'Method {method_key} has value but missing explicit unit; leaving method-specific entry unset.',
                })
            suggested_fields.pop(value_field, None)
            continue

        if method_key == 'pre_cultivation' and unit_value not in {'g_per_m2', 'g_per_lfm', 'seeds/m'}:
            if isinstance(warnings, list):
                warnings.append({
                    'field': value_field,
                    'code': 'seed_rate_unit_invalid_for_method',
                    'message': 'Method pre_cultivation only accepts g_per_m2, g_per_lfm, or seeds/m; entry skipped.',
                })
            suggested_fields.pop(value_field, None)
            continue
        if method_key == 'direct_sowing' and unit_value not in {'g_per_m2', 'g_per_lfm'}:
            if isinstance(warnings, list):
                warnings.append({
                    'field': value_field,
                    'code': 'seed_rate_unit_invalid_for_method',
                    'message': 'Method direct_sowing only accepts g_per_m2 or g_per_lfm; entry skipped.',
                })
            continue

        method_seed_rates[method_key] = {'value': parsed_value, 'unit': unit_value}

    if method_seed_rates:
        suggested_fields['seed_rate_by_cultivation'] = {
            'value': method_seed_rates,
            'unit': None,
            'confidence': 0.8,
        }

