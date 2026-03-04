"""Finalization helpers for enrichment orchestration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable


def normalize_choice_suggestions(
    suggested_fields: dict[str, Any],
    validation: dict[str, Any],
    normalize_choice_value: Callable[[str, object], object],
    allowed_choice_values: Callable[[str], set[str]],
) -> None:
    """Normalize and validate enum-like enrichment suggestions."""
    for field_name in ("nutrient_demand", "harvest_method"):
        if field_name not in suggested_fields or not isinstance(suggested_fields[field_name], dict):
            continue

        raw_value = suggested_fields[field_name].get("value")
        normalized_value = normalize_choice_value(field_name, raw_value)
        allowed_values = allowed_choice_values(field_name)
        if normalized_value in allowed_values:
            suggested_fields[field_name]["value"] = normalized_value
            continue

        suggested_fields.pop(field_name, None)
        warnings = validation.setdefault("warnings", [])
        if isinstance(warnings, list):
            warnings.append({
                "field": field_name,
                "code": "invalid_choice_dropped",
                "message": f"Dropped AI suggestion '{normalized_value}' for {field_name}; expected one of {sorted(allowed_values)}.",
            })


def ensure_supplier_product_error(evidence: dict[str, Any], validation: dict[str, Any]) -> None:
    """Emit supplier product not found error if no evidence entries remain."""
    if any(isinstance(entries, list) and entries for entries in evidence.values()):
        return
    errors = validation.setdefault('errors', [])
    if isinstance(errors, list):
        errors.append({
            'field': 'supplier_product_page',
            'code': 'supplier_product_not_found',
            'message': 'No supplier product page was found on allowed domains.',
        })


def apply_complete_mode_filter(
    *,
    mode: str,
    culture: Any,
    suggested_fields: dict[str, Any],
    validation: dict[str, Any],
    is_missing_culture_field: Callable[[Any, str], bool],
    missing_enrichment_fields: Callable[[Any], list[str]],
) -> dict[str, Any]:
    """Filter suggestions to unresolved fields in complete mode and add warnings."""
    if mode != "complete":
        return suggested_fields

    filtered = {
        field_name: suggestion
        for field_name, suggestion in suggested_fields.items()
        if field_name == 'notes' or is_missing_culture_field(culture, field_name)
    }

    unresolved_fields = [
        field_name
        for field_name in missing_enrichment_fields(culture)
        if field_name not in filtered
    ]
    if unresolved_fields:
        warnings = validation.setdefault("warnings", [])
        if isinstance(warnings, list):
            warnings.append({
                "field": "complete",
                "code": "fields_still_missing_after_research",
                "message": (
                    "Für folgende Felder konnten keine verlässlichen Informationen ermittelt werden: "
                    f"{', '.join(unresolved_fields)}."
                ),
            })

    return filtered


def maybe_default_harvest_method(culture: Any, suggested_fields: dict[str, Any], validation: dict[str, Any]) -> None:
    """Default harvest method when harvest data exists without explicit method."""
    if (
        'harvest_method' in suggested_fields
        or (culture.harvest_method or '').strip()
        or ('expected_yield' not in suggested_fields and 'harvest_duration_days' not in suggested_fields)
    ):
        return

    suggested_fields['harvest_method'] = {'value': 'per_sqm', 'unit': None, 'confidence': 0.45}
    warnings = validation.setdefault("warnings", [])
    if isinstance(warnings, list):
        warnings.append({
            'field': 'harvest_method',
            'code': 'harvest_method_defaulted',
            'message': 'Defaulted harvest_method to per_sqm because harvest data was suggested without method.',
        })


def extend_plausibility_warnings(
    culture: Any,
    suggested_fields: dict[str, Any],
    validation: dict[str, Any],
    compute_plausibility_warnings: Callable[[Any, dict[str, Any]], list[dict[str, str]]],
) -> None:
    """Append plausibility warnings produced by domain checks."""
    plausibility_warnings = compute_plausibility_warnings(culture, suggested_fields)
    if not plausibility_warnings:
        return

    warnings = validation.setdefault("warnings", [])
    if isinstance(warnings, list):
        warnings.extend(plausibility_warnings)


def build_result_payload(
    *,
    culture: Any,
    mode: str,
    provider: Any,
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    structured_sources: list[dict[str, str]],
    validation: dict[str, Any],
    usage: dict[str, int],
    cost_estimate: dict[str, Any],
) -> dict[str, Any]:
    """Build the final result payload returned by enrich_culture."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "run_id": f"enr_{culture.id}_{int(datetime.now().timestamp())}",
        "culture_id": culture.id,
        "mode": mode,
        "status": "completed",
        "started_at": now,
        "finished_at": now,
        "model": provider.model_name,
        "provider": provider.provider_name,
        "search_provider": provider.search_provider_name,
        "suggested_fields": suggested_fields,
        "evidence": evidence,
        "structured_sources": structured_sources,
        "validation": validation,
        "usage": usage,
        "costEstimate": cost_estimate,
    }
