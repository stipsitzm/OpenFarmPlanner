"""Output shaping helpers for enrichment suggestions and confidence."""

from __future__ import annotations

from typing import Any, Callable


def supplier_specific_entries(
    supplier_name: str,
    entries: object,
    split_entries: Callable[[str, object], tuple[list[dict[str, Any]], list[dict[str, Any]]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split evidence entries into supplier-specific and general groups."""
    return split_entries(supplier_name, entries)


def enforce_supplier_first_output(
    culture: Any,
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    validation: dict[str, Any],
    split_supplier_entries: Callable[[str, object], tuple[list[dict[str, Any]], list[dict[str, Any]]]],
    is_supplier_matching_evidence: Callable[[str, object], bool],
    coerce_text_value: Callable[[object, str], str],
) -> None:
    """Deterministically enforce supplier-first suggestions before returning the result."""
    supplier_name = (culture.supplier.name if culture.supplier else (culture.seed_supplier or '')).strip()
    warnings = validation.setdefault('warnings', [])

    for field_name, suggestion in list(suggested_fields.items()):
        if field_name == 'notes':
            continue

        supplier_entries, general_entries = split_supplier_entries(supplier_name, evidence.get(field_name))
        has_supplier_evidence = bool(supplier_entries)

        if has_supplier_evidence and general_entries:
            evidence[field_name] = supplier_entries
            if isinstance(warnings, list):
                warnings.append({
                    'field': field_name,
                    'code': 'supplier_evidence_preferred',
                    'message': 'Supplier-specific evidence exists; non-supplier evidence was removed.',
                })

        if field_name == 'seed_packages':
            if not has_supplier_evidence:
                suggested_fields['seed_packages'] = {
                    'value': [],
                    'unit': None,
                    'confidence': float(suggestion.get('confidence', 0.0)) if isinstance(suggestion, dict) else 0.0,
                }
                if isinstance(warnings, list):
                    warnings.append({
                        'field': 'seed_packages',
                        'code': 'seed_packages_require_supplier_evidence',
                        'message': 'Dropped seed package suggestions because supplier-specific evidence is missing.',
                    })
            elif isinstance(suggestion, dict):
                values = suggestion.get('value') if isinstance(suggestion.get('value'), list) else []
                filtered_values: list[dict[str, Any]] = []
                for item in values:
                    if not isinstance(item, dict):
                        continue
                    item_source = coerce_text_value(item.get('evidence_text') or '', 'seed_packages.evidence_text')
                    if item_source and not is_supplier_matching_evidence(
                        supplier_name,
                        [{'source_url': '', 'title': '', 'snippet': item_source}],
                    ):
                        continue
                    filtered_values.append(item)
                suggestion['value'] = filtered_values
                if isinstance(warnings, list) and len(filtered_values) != len(values):
                    warnings.append({
                        'field': 'seed_packages',
                        'code': 'seed_packages_require_supplier_evidence',
                        'message': 'Dropped seed package suggestions without supplier-specific evidence.',
                    })
            continue

        if has_supplier_evidence and not is_supplier_matching_evidence(supplier_name, evidence.get(field_name)):
            suggested_fields.pop(field_name, None)
            if isinstance(warnings, list):
                warnings.append({
                    'field': field_name,
                    'code': 'supplier_mismatch_dropped',
                    'message': 'Dropped suggestion because evidence did not match supplier.',
                })


def apply_source_weighted_confidence(
    culture: Any,
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    split_supplier_entries: Callable[[str, object], tuple[list[dict[str, Any]], list[dict[str, Any]]]],
    coerce_text_value: Callable[[object, str], str],
) -> None:
    """Adjust confidence scores according to supplier and source characteristics."""
    supplier_name = (culture.supplier.name if culture.supplier else (culture.seed_supplier or '')).strip()
    for field_name, suggestion in suggested_fields.items():
        if not isinstance(suggestion, dict):
            continue
        try:
            base_confidence = float(suggestion.get('confidence', 0.0))
        except (TypeError, ValueError):
            continue

        supplier_entries, general_entries = split_supplier_entries(supplier_name, evidence.get(field_name))
        adjusted = base_confidence
        if supplier_entries:
            adjusted += 0.1
        elif general_entries:
            adjusted -= 0.1

        entries = supplier_entries or general_entries
        independent_urls = {
            coerce_text_value(entry.get('source_url'), 'evidence.source_url')
            for entry in entries
            if isinstance(entry, dict)
        }
        independent_urls.discard('')
        if len(independent_urls) >= 2:
            adjusted += 0.05

        suggestion['confidence'] = round(min(1.0, max(0.0, adjusted)), 3)
