"""Culture-field completeness and plausibility helpers for enrichment."""

from __future__ import annotations

from typing import Any

from farm.models import Culture


def is_missing_culture_field(culture: Culture, suggested_field: str) -> bool:
    """Return True if a suggestion targets an empty value in the current culture."""
    direct_map = {
        'growth_duration_days': culture.growth_duration_days,
        'harvest_duration_days': culture.harvest_duration_days,
        'propagation_duration_days': culture.propagation_duration_days,
        'harvest_method': culture.harvest_method,
        'expected_yield': culture.expected_yield,
        'seed_packages': [{'size_value': float(p.size_value), 'size_unit': p.size_unit} for p in culture.seed_packages.all()],
        'seed_rate_value': culture.seed_rate_value,
        'seed_rate_unit': culture.seed_rate_unit,
        'allowed_sowing_methods': culture.cultivation_types,
        'thousand_kernel_weight_g': culture.thousand_kernel_weight_g,
        'nutrient_demand': culture.nutrient_demand,
        'cultivation_type': culture.cultivation_type,
        'notes': culture.notes,
    }
    if suggested_field in direct_map:
        value = direct_map[suggested_field]
        if isinstance(value, list):
            return len(value) == 0
        return value is None or (isinstance(value, str) and not value.strip())

    metric_map = {
        'distance_within_row_cm': culture.distance_within_row_m,
        'row_spacing_cm': culture.row_spacing_m,
        'sowing_depth_cm': culture.sowing_depth_m,
    }
    if suggested_field in metric_map:
        return metric_map[suggested_field] is None

    if suggested_field == 'seed_rate_direct_value':
        entry = (culture.seed_rate_by_cultivation or {}).get('direct_sowing') if isinstance(culture.seed_rate_by_cultivation, dict) else None
        if not isinstance(entry, dict):
            return True
        return entry.get('value') is None

    if suggested_field == 'seed_rate_transplant_value':
        entry = (culture.seed_rate_by_cultivation or {}).get('pre_cultivation') if isinstance(culture.seed_rate_by_cultivation, dict) else None
        if not isinstance(entry, dict):
            return True
        return entry.get('value') is None

    return True


def missing_enrichment_fields(culture: Culture) -> list[str]:
    """List enrichment fields that are still empty for complete mode."""
    field_names = [
        'growth_duration_days',
        'harvest_duration_days',
        'propagation_duration_days',
        'harvest_method',
        'expected_yield',
        'seed_packages',
        'distance_within_row_cm',
        'row_spacing_cm',
        'sowing_depth_cm',
        'allowed_sowing_methods',
        'seed_rate_direct_value',
        'seed_rate_transplant_value',
        'thousand_kernel_weight_g',
        'nutrient_demand',
    ]
    return [field for field in field_names if is_missing_culture_field(culture, field)]


def append_unresolved_fields_hint(notes_markdown: str, unresolved_fields: list[str]) -> str:
    """Append a German hint if some fields remain unresolved after research."""
    cleaned_notes = notes_markdown.strip()
    if not unresolved_fields:
        return cleaned_notes

    hint = (
        "Hinweis: Für folgende Felder konnten keine verlässlichen Informationen ermittelt werden: "
        f"{', '.join(unresolved_fields)}."
    )
    if hint in cleaned_notes:
        return cleaned_notes
    if not cleaned_notes:
        return hint
    return f"{cleaned_notes}\n\n{hint}"


def compute_plausibility_warnings(culture: Culture, suggested_fields: dict[str, Any]) -> list[dict[str, str]]:
    """Generate plausibility warnings without mutating suggested values."""
    warnings: list[dict[str, str]] = []

    def number_value(field_name: str, fallback: float | None) -> float | None:
        suggestion = suggested_fields.get(field_name)
        if isinstance(suggestion, dict):
            raw = suggestion.get('value')
            try:
                return float(raw)
            except (TypeError, ValueError):
                return fallback
        return fallback

    seed_rate_unit = None
    seed_rate_suggestion = suggested_fields.get('seed_rate_unit')
    if isinstance(seed_rate_suggestion, dict):
        seed_rate_unit = str(seed_rate_suggestion.get('value') or '').strip()
    elif culture.seed_rate_unit:
        seed_rate_unit = culture.seed_rate_unit

    if seed_rate_unit == 'seeds/m':
        seed_rate_value = number_value('seed_rate_value', culture.seed_rate_value)
        row_spacing_cm = number_value('row_spacing_cm', (culture.row_spacing_m * 100.0) if culture.row_spacing_m else None)
        if seed_rate_value and row_spacing_cm and row_spacing_cm > 0:
            plants_per_m2 = seed_rate_value * (100.0 / row_spacing_cm)
            if plants_per_m2 < 8 or plants_per_m2 > 45:
                warnings.append({
                    'field': 'seed_rate_value',
                    'code': 'density_out_of_range',
                    'message': f'Derived plants_per_m2={plants_per_m2:.1f} is outside plausible range (8-45).',
                })

    tkg = number_value('thousand_kernel_weight_g', culture.thousand_kernel_weight_g)
    if tkg is not None and tkg > 650:
        warnings.append({
            'field': 'thousand_kernel_weight_g',
            'code': 'tkg_high_needs_confirmation',
            'message': f'Thousand kernel weight {tkg:.1f} g is high; confirm with strong evidence.',
        })

    if 'salat' in (culture.name or '').lower():
        harvest_duration = number_value('harvest_duration_days', culture.harvest_duration_days)
        if harvest_duration is not None and harvest_duration > 50:
            warnings.append({
                'field': 'harvest_duration_days',
                'code': 'harvest_duration_unrealistic_for_leaf_lettuce',
                'message': 'Harvest duration appears unrealistic for leaf lettuce.',
            })

    return warnings
