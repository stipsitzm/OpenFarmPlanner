"""Shared helpers for enrichment parsing and normalization."""

from __future__ import annotations

import re
from typing import Any

from farm.enum_normalization import normalize_choice_value as normalize_backend_choice_value
from farm.models import Culture


def coerce_setting_to_str(value: object, setting_name: str) -> str:
    """Coerce setting values to a safe string representation."""
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    raise ValueError(f"Invalid {setting_name} type: expected string-like value.")


def coerce_text_value(value: object, field_name: str) -> str:
    """Coerce generic text values from provider output safely."""
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value).strip()
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    parts.append(text)
            elif isinstance(item, (int, float, bool)):
                parts.append(str(item).strip())
            else:
                import json

                parts.append(json.dumps(item, ensure_ascii=False))
        return "\n".join(part for part in parts if part)
    if isinstance(value, dict):
        import json

        return json.dumps(value, ensure_ascii=False, indent=2)
    raise ValueError(f"Invalid {field_name} type: expected text-like value.")


def normalize_choice_value(field_name: str, value: object) -> object:
    """Normalize AI-provided enum-like values into backend-compatible choices."""
    try:
        return normalize_backend_choice_value(field_name, value)
    except Exception:
        return value


def allowed_choice_values(field_name: str) -> set[str]:
    """Get allowed model choice values for enum-like Culture fields."""
    if field_name == 'seed_rate_unit':
        return {'g_per_m2', 'g_per_lfm', 'seeds_per_plant'}

    field = Culture._meta.get_field(field_name)
    return {str(choice[0]) for choice in (field.choices or []) if choice[0] is not None}


def normalize_numeric_field(raw_value: object) -> float | None:
    """Normalize one numeric field value to a float.

    Range strings are collapsed to a deterministic mean value.
    """
    if isinstance(raw_value, bool):
        return None
    if isinstance(raw_value, (int, float)):
        return float(raw_value)
    if not isinstance(raw_value, str):
        return None

    text = raw_value.strip()
    if not text:
        return None

    if '-' in text or '–' in text:
        range_matches = re.findall(r'\d+(?:[\.,]\d+)?', text)
        if len(range_matches) >= 2:
            try:
                low = float(range_matches[0].replace(',', '.'))
                high = float(range_matches[1].replace(',', '.'))
            except ValueError:
                return None
            return (low + high) / 2.0

    scalar_match = re.search(r'[-+]?\d+(?:[\.,]\d+)?', text)
    if not scalar_match:
        return None
    try:
        return float(scalar_match.group(0).replace(',', '.'))
    except ValueError:
        return None
