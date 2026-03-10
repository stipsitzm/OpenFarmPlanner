"""Supplier/source evidence helpers for enrichment output."""

from __future__ import annotations

import re
from urllib.parse import urlparse
from typing import Any, Callable

from farm.models import Culture


def normalize_supplier_text(value: str) -> str:
    """Normalize supplier text for case-insensitive source matching."""
    return re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()


def is_supplier_matching_evidence(
    supplier_name: str,
    evidence_entries: object,
    coerce_text: Callable[[object, str], str],
) -> bool:
    """Check whether evidence entries reference the expected supplier."""
    normalized_supplier = normalize_supplier_text(supplier_name)
    if not normalized_supplier:
        return True
    if not isinstance(evidence_entries, list):
        return False

    supplier_tokens = [token for token in normalized_supplier.split() if len(token) >= 3]
    for entry in evidence_entries:
        if not isinstance(entry, dict):
            continue
        source_text = ' '.join([
            coerce_text(entry.get('source_url', ''), 'evidence.source_url'),
            coerce_text(entry.get('title', ''), 'evidence.title'),
            coerce_text(entry.get('snippet', ''), 'evidence.snippet'),
        ])
        normalized_source = normalize_supplier_text(source_text)
        if not normalized_source:
            continue
        if normalized_supplier in normalized_source:
            return True
        if supplier_tokens and all(token in normalized_source for token in supplier_tokens):
            return True

    return False


def supplier_domains_for_culture(culture: Culture) -> set[str]:
    """Return normalized supplier domains from culture supplier metadata."""
    supplier = culture.supplier
    if not supplier:
        return set()
    domains = {
        str(domain).strip().lower().removeprefix('www.')
        for domain in (supplier.allowed_domains or [])
        if str(domain).strip()
    }
    return {domain for domain in domains if domain}


def url_matches_supplier_domains(url: str, supplier_domains: set[str]) -> bool:
    """Return True when the URL host belongs to the supplier domain set."""
    if not supplier_domains:
        return False
    try:
        host = (urlparse(url).hostname or '').lower()
    except Exception:  # noqa: BLE001
        return False
    if not host:
        return False
    return any(host == domain or host.endswith(f'.{domain}') for domain in supplier_domains)


def filter_evidence_to_allowed_domains(
    evidence: dict[str, Any],
    supplier_domains: set[str],
    validation: dict[str, Any],
    coerce_text: Callable[[object, str], str],
) -> None:
    """Filter evidence entries to supplier domains for seed packages only."""
    warnings = validation.setdefault('warnings', [])
    for field_name, entries in list(evidence.items()):
        if not isinstance(entries, list):
            continue
        if field_name != 'seed_packages':
            continue
        kept: list[dict[str, Any]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            source_url = coerce_text(entry.get('source_url', ''), 'evidence.source_url')
            if url_matches_supplier_domains(source_url, supplier_domains):
                kept.append(entry)
            elif isinstance(warnings, list):
                warnings.append({
                    'field': field_name,
                    'code': 'evidence_domain_not_allowed',
                    'message': f'Removed evidence outside supplier domain whitelist: {source_url}',
                })
        evidence[field_name] = kept


def enforce_supplier_evidence_requirements(
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    validation: dict[str, Any],
) -> None:
    """Enforce supplier-evidence requirements for seed packages only."""
    warnings = validation.setdefault('warnings', [])
    for field_name in list(suggested_fields.keys()):
        if field_name == 'notes':
            continue
        remaining_evidence = evidence.get(field_name)
        has_evidence = isinstance(remaining_evidence, list) and len(remaining_evidence) > 0
        if field_name == 'seed_packages' and not has_evidence:
            suggested_fields['seed_packages'] = {'value': [], 'unit': None, 'confidence': 0.0}
            if isinstance(warnings, list):
                warnings.append({'field': 'seed_packages', 'code': 'missing_supplier_evidence', 'message': 'Seed package suggestions require supplier-domain evidence.'})


def add_category_mismatch_warning(
    culture: Culture,
    evidence: dict[str, Any],
    validation: dict[str, Any],
    coerce_text: Callable[[object, str], str],
) -> None:
    """Warn when likely supplier product page path does not match crop category."""
    supplier_entries = evidence.get('seed_packages') or evidence.get('growth_duration_days') or []
    if not isinstance(supplier_entries, list) or not supplier_entries:
        return
    first = supplier_entries[0] if isinstance(supplier_entries[0], dict) else {}
    source_url = coerce_text(first.get('source_url', ''), 'evidence.source_url').lower()
    crop = (culture.name or '').strip().lower()
    if not source_url or not crop:
        return
    penalties = {'mais', 'corn', 'tomaten', 'tomato', 'karotte', 'carrot'}
    if crop not in source_url and any(seg in source_url for seg in penalties if seg not in crop):
        warnings = validation.setdefault('warnings', [])
        if isinstance(warnings, list):
            warnings.append({'field': 'supplier_product_page', 'code': 'supplier_page_category_mismatch', 'message': 'Selected supplier page path appears category-mismatched.'})




def is_plausible_supplier_source_url(url: str, culture_name: str) -> bool:
    """Return False for obviously category-mismatched supplier paths."""
    if not url:
        return False
    lower_url = url.lower()
    crop = (culture_name or '').strip().lower()
    if not crop:
        return True

    alias_map = {
        'salat': ['salat', 'lettuce', 'loose_leaf_lettuce'],
        'möhre': ['möhre', 'moehre', 'karotte', 'carrot'],
        'karotte': ['möhre', 'moehre', 'karotte', 'carrot'],
        'mais': ['mais', 'corn'],
        'tomate': ['tomate', 'tomaten', 'tomato'],
    }
    aliases = alias_map.get(crop, [crop])
    if any(alias in lower_url for alias in aliases):
        return True

    conflicting_tokens = {'mais', 'corn', 'tomate', 'tomato', 'karotte', 'carrot', 'möhre', 'moehre'}
    if any(token in lower_url for token in conflicting_tokens if token not in aliases):
        return False

    return True


def is_supplier_entry(
    entry: dict[str, Any],
    supplier_name: str,
    supplier_domains: set[str],
    coerce_text: Callable[[object, str], str],
) -> bool:
    """Return True if evidence entry is explicitly or implicitly supplier-specific."""
    tagged = entry.get('supplier_specific')
    if isinstance(tagged, bool):
        return tagged
    url = coerce_text(entry.get('source_url', ''), 'evidence.source_url')
    if url_matches_supplier_domains(url, supplier_domains):
        return True
    return is_supplier_matching_evidence(supplier_name, [entry], coerce_text)


def build_structured_sources(
    culture: Culture,
    evidence: dict[str, Any],
    coerce_text: Callable[[object, str], str],
) -> list[dict[str, str]]:
    """Build structured source metadata from evidence entries."""
    sources: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    supplier_name = (culture.supplier.name if culture.supplier else culture.seed_supplier or '').lower()
    variety_name = (culture.variety or '').lower()

    for entries in evidence.values():
        if not isinstance(entries, list):
            continue
        for item in entries:
            if not isinstance(item, dict):
                continue
            url = coerce_text(item.get('source_url', ''), 'evidence.source_url')
            title = coerce_text(item.get('title', ''), 'evidence.title')
            snippet = coerce_text(item.get('snippet', ''), 'evidence.snippet')
            retrieved_at = coerce_text(item.get('retrieved_at', ''), 'evidence.retrieved_at')
            if not url:
                continue
            key = (url, title)
            if key in seen:
                continue
            seen.add(key)

            lc = f"{title} {url} {snippet}".lower()
            is_variety_specific = bool(variety_name and variety_name in lc) or bool(supplier_name and supplier_name in lc)
            source_type = 'variety_specific' if is_variety_specific else 'general_crop'
            claim_summary = snippet[:240] if snippet else title

            sources.append({
                'title': title or url,
                'url': url,
                'type': source_type,
                'retrieved_at': retrieved_at,
                'claim_summary': claim_summary,
            })
    return sources


def render_sources_markdown(structured_sources: list[dict[str, str]]) -> str:
    """Render structured sources into a markdown sources section."""
    if not structured_sources:
        return ''

    variety = [s for s in structured_sources if s.get('type') == 'variety_specific']
    general = [s for s in structured_sources if s.get('type') == 'general_crop']

    lines = ["## Quellen"]
    if variety:
        lines.append("### Sortenspezifische Quellen")
        for src in variety:
            lines.append(f"- [{src['title']}]({src['url']})")
    if general:
        lines.append("### Allgemeine Kulturinformationen")
        for src in general:
            lines.append(f"- [{src['title']}]({src['url']})")
    return "\n".join(lines).strip()


def supplier_specific_entries(
    supplier_name: str,
    entries: object,
    coerce_text: Callable[[object, str], str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split evidence entries into supplier-specific and general groups."""
    supplier_entries: list[dict[str, Any]] = []
    general_entries: list[dict[str, Any]] = []
    if not isinstance(entries, list):
        return supplier_entries, general_entries

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        tagged_supplier = entry.get('supplier_specific')
        is_supplier = bool(tagged_supplier) if isinstance(tagged_supplier, bool) else is_supplier_matching_evidence(supplier_name, [entry], coerce_text)
        if is_supplier:
            supplier_entries.append(entry)
        else:
            general_entries.append(entry)
    return supplier_entries, general_entries
