"""Culture enrichment service with pluggable provider and optional web research.

All user-facing text stays in German in the frontend; backend comments/logs are English.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timezone
from typing import Any

import requests
from django.conf import settings

from farm.models import Culture, EnrichmentAccountingRun
from farm.services import enrichment_fields, enrichment_finalize, enrichment_notes, enrichment_openai, enrichment_output, enrichment_postprocess, enrichment_prompt, enrichment_sources, enrichment_sowing
from farm.services.enrichment_common import (
    allowed_choice_values as common_allowed_choice_values,
    coerce_setting_to_str as common_coerce_setting_to_str,
    coerce_text_value as common_coerce_text_value,
    normalize_choice_value as common_normalize_choice_value,
    normalize_numeric_field,
)

INPUT_COST_PER_MILLION = Decimal('2.00')
CACHED_INPUT_COST_PER_MILLION = Decimal('0.50')
OUTPUT_COST_PER_MILLION = Decimal('8.00')
WEB_SEARCH_CALL_COST_USD = Decimal('0.01')
TAX_RATE = Decimal('0.20')

NUMERIC_SUGGESTED_FIELDS: tuple[str, ...] = (
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'distance_within_row_cm',
    'row_spacing_cm',
    'sowing_depth_cm',
    'seed_rate_direct_value',
    'seed_rate_transplant_value',
    'thousand_kernel_weight_g',
    'expected_yield',
)


def _extract_usage(payload: dict[str, Any]) -> dict[str, int]:
    """Extract token usage values from an OpenAI Responses payload.

    :param payload: Raw JSON payload returned by the provider.
    :return: Dictionary with input_tokens, cached_input_tokens and output_tokens.
    """
    usage = payload.get('usage') if isinstance(payload.get('usage'), dict) else {}
    input_tokens = int(usage.get('input_tokens') or 0)
    output_tokens = int(usage.get('output_tokens') or 0)
    input_details = usage.get('input_tokens_details') if isinstance(usage.get('input_tokens_details'), dict) else {}
    cached_input_tokens = int(input_details.get('cached_tokens') or 0)
    if cached_input_tokens > input_tokens:
        cached_input_tokens = input_tokens
    return {
        'input_tokens': input_tokens,
        'cached_input_tokens': cached_input_tokens,
        'output_tokens': output_tokens,
    }


def _count_web_search_calls(payload: dict[str, Any]) -> int:
    """Count web search tool call items in a Responses payload.

    :param payload: Raw JSON payload returned by the provider.
    :return: Number of detected web search tool calls.
    """
    count = 0
    for item in payload.get('output', []) or []:
        if not isinstance(item, dict):
            continue

        item_type = str(item.get('type') or '').lower()
        tool_type = str(item.get('tool_type') or item.get('name') or '').lower()
        if 'web_search' in item_type or 'web_search' in tool_type:
            count += 1
            continue

        if item_type in {'tool_call', 'tool'} and 'web' in tool_type and 'search' in tool_type:
            count += 1
    return count


def _build_cost_estimate(
    *,
    input_tokens: int,
    cached_input_tokens: int,
    output_tokens: int,
    web_search_call_count: int,
    model: str,
) -> dict[str, Any]:
    """Build a deterministic USD cost estimate for one enrichment invocation.

    :param input_tokens: Total model input tokens.
    :param cached_input_tokens: Cached subset of input tokens.
    :param output_tokens: Total model output tokens.
    :param web_search_call_count: Number of web search tool calls.
    :param model: Provider model name.
    :return: Cost payload with total and breakdown.
    """
    non_cached_input_tokens = max(input_tokens - cached_input_tokens, 0)
    input_cost = (Decimal(non_cached_input_tokens) / Decimal(1_000_000)) * INPUT_COST_PER_MILLION
    cached_input_cost = (Decimal(cached_input_tokens) / Decimal(1_000_000)) * CACHED_INPUT_COST_PER_MILLION
    output_cost = (Decimal(output_tokens) / Decimal(1_000_000)) * OUTPUT_COST_PER_MILLION
    web_search_cost = Decimal(web_search_call_count) * WEB_SEARCH_CALL_COST_USD
    subtotal_cost = input_cost + cached_input_cost + output_cost + web_search_cost
    tax_amount = subtotal_cost * TAX_RATE
    total_cost = subtotal_cost + tax_amount
    return {
        'currency': 'USD',
        'total': float(total_cost),
        'model': model,
        'breakdown': {
            'input': float(input_cost),
            'cached_input': float(cached_input_cost),
            'output': float(output_cost),
            'web_search_calls': float(web_search_cost),
            'web_search_call_count': web_search_call_count,
            'subtotal': float(subtotal_cost),
            'tax': float(tax_amount),
        },
    }


def _persist_accounting_run(culture: Culture, mode: str, result: dict[str, Any]) -> None:
    """Persist one accounting row for an enrichment invocation.

    :param culture: Culture associated with the run.
    :param mode: Enrichment mode used for this run.
    :param result: Final enrichment response payload.
    :return: None.
    """
    usage = result.get('usage') if isinstance(result.get('usage'), dict) else {}
    cost_estimate = result.get('costEstimate') if isinstance(result.get('costEstimate'), dict) else {}
    breakdown = cost_estimate.get('breakdown') if isinstance(cost_estimate.get('breakdown'), dict) else {}

    EnrichmentAccountingRun.objects.create(
        culture=culture,
        mode=mode,
        provider=str(result.get('provider') or ''),
        model=str(result.get('model') or ''),
        input_tokens=int(usage.get('inputTokens') or 0),
        cached_input_tokens=int(usage.get('cachedInputTokens') or 0),
        output_tokens=int(usage.get('outputTokens') or 0),
        web_search_call_count=int(breakdown.get('web_search_call_count') or 0),
        estimated_cost_usd=Decimal(str(cost_estimate.get('total') or 0)),
    )


def _coerce_setting_to_str(value: object, setting_name: str) -> str:
    """Coerce setting values and raise enrichment-specific errors."""
    try:
        return common_coerce_setting_to_str(value, setting_name)
    except ValueError as exc:
        raise EnrichmentError(str(exc)) from exc


def _coerce_text_value(value: object, field_name: str) -> str:
    """Coerce text-like payload values and raise enrichment-specific errors."""
    try:
        return common_coerce_text_value(value, field_name)
    except ValueError as exc:
        raise EnrichmentError(str(exc)) from exc


def _normalize_choice_value(field_name: str, value: object) -> object:
    """Normalize AI-provided enum-like values into backend-compatible choices."""
    return common_normalize_choice_value(field_name, value)


def _allowed_choice_values(field_name: str) -> set[str]:
    """Get allowed model choice values for enum-like Culture fields."""
    return common_allowed_choice_values(field_name)


def _extract_json_objects(text: str) -> list[dict[str, Any]]:
    """Extract JSON objects from free text, best-effort."""
    return enrichment_notes.extract_json_objects(text)


def _note_blocks_to_markdown(note_blocks: object) -> str:
    """Convert provider note blocks to clean markdown (avoid raw JSON artifacts)."""
    return enrichment_notes.note_blocks_to_markdown(note_blocks, _coerce_text_value)


def _is_missing_culture_field(culture: Culture, suggested_field: str) -> bool:
    """Return True if a suggestion targets an empty value in the current culture."""
    return enrichment_fields.is_missing_culture_field(culture, suggested_field)


def _missing_enrichment_fields(culture: Culture) -> list[str]:
    """List enrichment fields that are still empty for complete mode."""
    return enrichment_fields.missing_enrichment_fields(culture)


def _compute_plausibility_warnings(culture: Culture, suggested_fields: dict[str, Any]) -> list[dict[str, str]]:
    """Generate plausibility warnings without mutating suggested values."""
    return enrichment_fields.compute_plausibility_warnings(culture, suggested_fields)


def _normalize_sowing_method_enrichment_fields(
    culture: Culture,
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    validation: dict[str, Any],
) -> None:
    """Normalize sowing-method suggestions and replace legacy single seed-rate fields."""
    enrichment_sowing.normalize_sowing_method_enrichment_fields(
        culture,
        suggested_fields,
        evidence,
        validation,
        _normalize_choice_value,
        _coerce_text_value,
        normalize_numeric_field,
    )




def _apply_method_seed_rates_to_suggestions(suggested_fields: dict[str, Any], validation: dict[str, Any]) -> None:
    """Build seed_rate_by_cultivation from method-specific enrichment fields."""
    enrichment_sowing.apply_method_seed_rates_to_suggestions(suggested_fields, validation, _normalize_choice_value)






def _normalize_supplier_text(value: str) -> str:
    """Normalize supplier text for case-insensitive source matching."""
    return enrichment_sources.normalize_supplier_text(value)


def _is_supplier_matching_evidence(supplier_name: str, evidence_entries: object) -> bool:
    """Check whether evidence entries reference the expected supplier."""
    return enrichment_sources.is_supplier_matching_evidence(supplier_name, evidence_entries, _coerce_text_value)


def _supplier_domains_for_culture(culture: Culture) -> set[str]:
    """Return normalized supplier domains from culture supplier metadata."""
    return enrichment_sources.supplier_domains_for_culture(culture)


def _url_matches_supplier_domains(url: str, supplier_domains: set[str]) -> bool:
    """Return True when the URL host belongs to the supplier domain set."""
    return enrichment_sources.url_matches_supplier_domains(url, supplier_domains)



def _filter_evidence_to_allowed_domains(
    evidence: dict[str, Any],
    supplier_domains: set[str],
    validation: dict[str, Any],
) -> None:
    """Filter evidence entries to supplier domains for seed packages only."""
    enrichment_sources.filter_evidence_to_allowed_domains(evidence, supplier_domains, validation, _coerce_text_value)


def _enforce_supplier_evidence_requirements(
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    validation: dict[str, Any],
) -> None:
    """Enforce supplier-evidence requirements for seed packages only."""
    enrichment_sources.enforce_supplier_evidence_requirements(suggested_fields, evidence, validation)


def _add_category_mismatch_warning(culture: Culture, evidence: dict[str, Any], validation: dict[str, Any]) -> None:
    """Warn when likely supplier product page path does not match crop category."""
    enrichment_sources.add_category_mismatch_warning(culture, evidence, validation, _coerce_text_value)

def _is_supplier_entry(entry: dict[str, Any], supplier_name: str, supplier_domains: set[str]) -> bool:
    """Return True if evidence entry is explicitly or implicitly supplier-specific."""
    return enrichment_sources.is_supplier_entry(entry, supplier_name, supplier_domains, _coerce_text_value)

def _build_structured_sources(
    culture: Culture,
    evidence: dict[str, Any],
) -> list[dict[str, str]]:
    """Build structured source metadata from evidence entries."""
    return enrichment_sources.build_structured_sources(culture, evidence, _coerce_text_value)

def _render_sources_markdown(structured_sources: list[dict[str, str]]) -> str:
    """Render structured sources into a markdown sources section."""
    return enrichment_sources.render_sources_markdown(structured_sources)

class EnrichmentError(Exception):
    """Raised when enrichment provider fails."""


@dataclass
class EnrichmentContext:
    """Context object used by providers."""

    culture: Culture
    mode: str


class BaseEnrichmentProvider:
    """Provider interface for enrichment implementations."""

    provider_name = "base"
    model_name = "n/a"
    search_provider_name = "n/a"

    def enrich(self, context: EnrichmentContext) -> dict[str, Any]:
        raise NotImplementedError


class OpenAIResponsesProvider(BaseEnrichmentProvider):
    """OpenAI Responses API provider using web_search capable tools."""

    provider_name = "openai_responses"
    model_name = 'gpt-5'
    search_provider_name = "web_search"

    def __init__(self, api_key: str | None = None) -> None:
        raw_key = api_key if api_key is not None else getattr(settings, 'OPENAI_API_KEY', '')
        resolved_key = _coerce_setting_to_str(raw_key, 'OPENAI_API_KEY')
        if not resolved_key:
            raise EnrichmentError(
                "AI provider 'openai_responses' is configured but OPENAI_API_KEY is missing."
            )
        self.api_key = resolved_key

    def _resolved_model_name(self) -> str:
        return _coerce_setting_to_str(getattr(settings, 'AI_ENRICHMENT_MODEL', 'gpt-5'), 'AI_ENRICHMENT_MODEL') or 'gpt-5'

    @property
    def model_name(self) -> str:
        return self._resolved_model_name()

    def _responses_url(self) -> str:
        raw = getattr(settings, 'OPENAI_RESPONSES_API_URL', 'https://api.openai.com/v1/responses')
        url = _coerce_setting_to_str(raw, 'OPENAI_RESPONSES_API_URL')
        return url or 'https://api.openai.com/v1/responses'

    def _request_timeout(self) -> tuple[float, float]:
        connect_timeout = float(getattr(settings, 'AI_ENRICHMENT_CONNECT_TIMEOUT_SECONDS', 10))
        read_timeout_setting = getattr(settings, 'AI_ENRICHMENT_READ_TIMEOUT_SECONDS', None)
        if read_timeout_setting in (None, ''):
            read_timeout = float(getattr(settings, 'AI_ENRICHMENT_TIMEOUT_SECONDS', 180))
        else:
            read_timeout = float(read_timeout_setting)
        return (connect_timeout, read_timeout)

    def _build_prompt(
        self,
        culture: Culture,
        mode: str,
        *,
        target_fields: list[str] | None = None,
        supplier_only: bool = True,
    ) -> str:
        """Build the deterministic prompt for enrichment extraction."""
        return enrichment_prompt.build_prompt(
            culture=culture,
            mode=mode,
            target_fields=target_fields,
            supplier_only=supplier_only,
            missing_enrichment_fields=_missing_enrichment_fields,
            supplier_domains_for_culture=_supplier_domains_for_culture,
        )

    def _extract_text_payload(self, payload: dict[str, Any]) -> str:
        """Extract model text from Responses API payload across schema variants."""
        try:
            return enrichment_openai.extract_text_payload(payload)
        except ValueError as exc:
            raise EnrichmentError(str(exc)) from exc

    def _parse_json_block(self, text: str) -> dict[str, Any]:
        """Parse JSON from text, including fenced code blocks and mixed prose."""
        try:
            return enrichment_openai.parse_json_block(text)
        except ValueError as exc:
            raise EnrichmentError(str(exc)) from exc

    def _request_enrichment_payload(self, prompt: str, model_name: str) -> tuple[dict[str, Any], dict[str, int], int]:
        """Execute one Responses API call and return parsed payload with usage metadata."""
        try:
            return enrichment_openai.request_enrichment_payload(
                api_key=self.api_key,
                responses_url=self._responses_url(),
                request_timeout=self._request_timeout(),
                prompt=prompt,
                model_name=model_name,
                extract_usage=_extract_usage,
                count_web_search_calls=_count_web_search_calls,
            )
        except ValueError as exc:
            raise EnrichmentError(str(exc)) from exc

    def _merge_phase_payloads(self, base: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
        """Merge two provider payloads without changing the output contract."""
        return enrichment_openai.merge_phase_payloads(base, fallback)

    def _has_supplier_specific_evidence(self, supplier_name: str, evidence: object) -> bool:
        """Return True when any evidence entry references the configured supplier."""
        return enrichment_openai.has_supplier_specific_evidence(
            supplier_name,
            evidence,
            _is_supplier_matching_evidence,
        )

    def _apply_supplier_only_filter(self, payload: dict[str, Any], culture: Culture) -> dict[str, Any]:
        """Filter provider payload to strict supplier evidence for seed packages only."""
        return enrichment_openai.apply_supplier_only_filter(
            payload,
            culture,
            _supplier_domains_for_culture,
            _is_supplier_entry,
        )

    def enrich(self, context: EnrichmentContext) -> dict[str, Any]:
        model_name = self.model_name
        supplier_name = context.culture.supplier.name if context.culture.supplier else (context.culture.seed_supplier or '')

        phase_one_prompt = self._build_prompt(context.culture, context.mode, supplier_only=True)
        primary_result, primary_usage, primary_search_calls = self._request_enrichment_payload(phase_one_prompt, model_name)
        primary_result = self._apply_supplier_only_filter(primary_result, context.culture)

        combined_result = primary_result
        total_usage = dict(primary_usage)
        total_search_calls = primary_search_calls

        should_fallback = not self._has_supplier_specific_evidence(supplier_name, primary_result.get('evidence'))
        if should_fallback:
            target_fields = _missing_enrichment_fields(context.culture) if context.mode == 'complete' else []
            fallback_prompt = self._build_prompt(
                context.culture,
                context.mode,
                target_fields=target_fields,
                supplier_only=False,
            )
            fallback_result, fallback_usage, fallback_search_calls = self._request_enrichment_payload(fallback_prompt, model_name)
            combined_result = self._merge_phase_payloads(primary_result, fallback_result)
            total_usage = {
                'input_tokens': primary_usage['input_tokens'] + fallback_usage['input_tokens'],
                'cached_input_tokens': primary_usage['cached_input_tokens'] + fallback_usage['cached_input_tokens'],
                'output_tokens': primary_usage['output_tokens'] + fallback_usage['output_tokens'],
            }
            total_search_calls += fallback_search_calls

        combined_result["usage"] = total_usage
        combined_result["cost_estimate"] = _build_cost_estimate(
            input_tokens=total_usage['input_tokens'],
            cached_input_tokens=total_usage['cached_input_tokens'],
            output_tokens=total_usage['output_tokens'],
            web_search_call_count=total_search_calls,
            model=model_name,
        )
        return combined_result


class FallbackHeuristicProvider(BaseEnrichmentProvider):
    """Fallback provider that creates minimal suggestions without external calls."""

    provider_name = "fallback"
    model_name = "heuristic-v1"
    search_provider_name = "none"

    def enrich(self, context: EnrichmentContext) -> dict[str, Any]:
        culture = context.culture
        now = datetime.now(timezone.utc).isoformat()
        suggestions: dict[str, Any] = {}
        if context.mode == "reresearch" or culture.cultivation_type in {"", None}:
            suggestions["cultivation_type"] = {"value": "direct_sowing", "unit": None, "confidence": 0.35}
        if context.mode == "reresearch" or culture.nutrient_demand in {"", None}:
            suggestions["nutrient_demand"] = {"value": "medium", "unit": None, "confidence": 0.3}

        note_block = (
            "## Dauerwerte\n"
            "- Keine verlässlichen Webquellen automatisch gefunden.\n\n"
            "## Aussaat & Abstände (zusammengefasst)\n"
            "- Bitte manuell prüfen.\n\n"
            "## Ernte & Verwendung\n"
            "- Bitte manuell prüfen.\n\n"
            "## Quellen\n"
            "- Keine Quellen verfügbar (Fallback-Modus)."
        )

        return {
            "suggested_fields": suggestions,
            "evidence": {},
            "validation": {
                "warnings": [{"field": "notes", "code": "fallback_mode", "message": "No web-research provider configured."}],
                "errors": [],
            },
            "note_blocks": note_block,
            "metadata": {"generated_at": now},
            "usage": {
                "input_tokens": 0,
                "cached_input_tokens": 0,
                "output_tokens": 0,
            },
            "cost_estimate": _build_cost_estimate(
                input_tokens=0,
                cached_input_tokens=0,
                output_tokens=0,
                web_search_call_count=0,
                model=self.model_name,
            ),
        }


def _parse_notes_sections(markdown_text: str) -> tuple[str, dict[str, str], list[tuple[str, str]]]:
    """Parse markdown into intro text, known sections and other sections."""
    return enrichment_notes.parse_notes_sections(markdown_text)


def _combine_text_blocks(*blocks: str) -> str:
    """Combine markdown blocks while removing exact duplicates."""
    return enrichment_notes.combine_text_blocks(*blocks)


def _dedupe_section_content(content: str) -> str:
    """Remove repeated paragraphs inside one markdown section."""
    return enrichment_notes.dedupe_section_content(content)


def build_note_appendix(base_notes: object, note_blocks: object) -> str:
    """Integrate generated notes into a clean, sectioned markdown structure."""
    return enrichment_notes.build_note_appendix(base_notes, note_blocks, _coerce_text_value)


def get_enrichment_provider() -> BaseEnrichmentProvider:
    """Return provider by configured settings."""
    raw_provider = getattr(settings, 'AI_ENRICHMENT_PROVIDER', 'openai_responses')
    provider = _coerce_setting_to_str(raw_provider, 'AI_ENRICHMENT_PROVIDER')
    if provider == "openai_responses":
        return OpenAIResponsesProvider(api_key=getattr(settings, 'OPENAI_API_KEY', ''))
    if provider == 'fallback':
        return FallbackHeuristicProvider()
    raise EnrichmentError(f"Unsupported AI_ENRICHMENT_PROVIDER '{provider}'")



def _normalize_suggested_fields_payload(payload: object, validation: dict[str, Any]) -> dict[str, Any]:
    """Normalize suggested_fields payload to mapping form without raising hard errors."""
    return enrichment_postprocess.normalize_suggested_fields_payload(payload, validation, _coerce_text_value)

def _supplier_specific_entries(supplier_name: str, entries: object) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split evidence entries into supplier-specific and general groups."""
    return enrichment_output.supplier_specific_entries(
        supplier_name,
        entries,
        lambda current_supplier, current_entries: enrichment_sources.supplier_specific_entries(
            current_supplier,
            current_entries,
            _coerce_text_value,
        ),
    )


def _enforce_supplier_first_output(
    culture: Culture,
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
    validation: dict[str, Any],
) -> None:
    """Deterministically enforce supplier-first suggestions before returning the result."""
    enrichment_output.enforce_supplier_first_output(
        culture,
        suggested_fields,
        evidence,
        validation,
        _supplier_specific_entries,
        _is_supplier_matching_evidence,
        _coerce_text_value,
    )


def _apply_source_weighted_confidence(
    culture: Culture,
    suggested_fields: dict[str, Any],
    evidence: dict[str, Any],
) -> None:
    """Adjust confidence scores according to supplier and source characteristics."""
    enrichment_output.apply_source_weighted_confidence(
        culture,
        suggested_fields,
        evidence,
        _supplier_specific_entries,
        _coerce_text_value,
    )


def _validate_seed_package_suggestions(suggested_fields: dict[str, Any], evidence: dict[str, Any], validation: dict[str, Any]) -> None:
    """Validate and normalize seed package suggestions."""
    enrichment_postprocess.validate_seed_package_suggestions(suggested_fields, evidence, validation)

def _normalize_suggested_field_values(suggested_fields: dict[str, Any], validation: dict[str, Any]) -> None:
    """Normalize value formats for numeric fields while preserving response schema."""
    enrichment_postprocess.normalize_suggested_field_values(
        suggested_fields,
        validation,
        NUMERIC_SUGGESTED_FIELDS,
        normalize_numeric_field,
        _coerce_text_value,
    )

def enrich_culture(culture: Culture, mode: str) -> dict[str, Any]:
    """Generate enrichment suggestions for one culture."""
    if mode not in {"complete", "reresearch"}:
        raise EnrichmentError("Unsupported mode")

    if not getattr(settings, 'AI_ENRICHMENT_ENABLED', True):
        raise EnrichmentError('AI enrichment is disabled by configuration.')

    if not culture.supplier_id:
        raise EnrichmentError('supplier_missing: Supplier is required for AI enrichment.')

    if not (culture.supplier and culture.supplier.allowed_domains):
        raise EnrichmentError('allowed_domains_missing: Supplier allowed domains are required for AI enrichment.')

    provider = get_enrichment_provider()
    context = EnrichmentContext(culture=culture, mode=mode)
    try:
        raw = provider.enrich(context)
    except EnrichmentError:
        allow_auto_fallback = bool(getattr(settings, 'AI_ENRICHMENT_AUTO_FALLBACK_ON_ERROR', False))
        if provider.provider_name == 'fallback' or not allow_auto_fallback:
            raise
        provider = FallbackHeuristicProvider()
        raw = provider.enrich(context)

    suggested_fields = raw.get("suggested_fields", {})
    evidence = raw.get("evidence", {})
    validation = raw.get("validation", {"warnings": [], "errors": []})
    note_blocks = raw.get("note_blocks", "")
    raw_usage = raw.get('usage') if isinstance(raw.get('usage'), dict) else {}
    usage = {
        'inputTokens': int(raw_usage.get('input_tokens') or 0),
        'cachedInputTokens': int(raw_usage.get('cached_input_tokens') or 0),
        'outputTokens': int(raw_usage.get('output_tokens') or 0),
    }
    cost_estimate = raw.get('cost_estimate') if isinstance(raw.get('cost_estimate'), dict) else _build_cost_estimate(
        input_tokens=usage['inputTokens'],
        cached_input_tokens=usage['cachedInputTokens'],
        output_tokens=usage['outputTokens'],
        web_search_call_count=0,
        model=provider.model_name,
    )

    if not isinstance(validation, dict):
        validation = {'warnings': [], 'errors': []}
    suggested_fields = _normalize_suggested_fields_payload(suggested_fields, validation)
    if not isinstance(evidence, dict):
        evidence = {}
        warnings = validation.setdefault('warnings', [])
        if isinstance(warnings, list):
            warnings.append({
                'field': 'evidence',
                'code': 'invalid_evidence_payload',
                'message': 'Invalid evidence payload type; treating as empty mapping.',
            })

    supplier_domains = _supplier_domains_for_culture(culture)
    _filter_evidence_to_allowed_domains(evidence, supplier_domains, validation)
    _enforce_supplier_evidence_requirements(suggested_fields, evidence, validation)
    _add_category_mismatch_warning(culture, evidence, validation)

    structured_sources = _build_structured_sources(culture, evidence)

    if note_blocks:
        cleaned_note_blocks = _note_blocks_to_markdown(note_blocks).strip()
        suggested_fields["notes"] = {
            "value": cleaned_note_blocks,
            "unit": None,
            "confidence": 0.8 if provider.provider_name != "fallback" else 0.4,
        }

    enrichment_finalize.normalize_choice_suggestions(
        suggested_fields,
        validation,
        _normalize_choice_value,
        _allowed_choice_values,
    )

    _validate_seed_package_suggestions(suggested_fields, evidence, validation)
    _normalize_suggested_field_values(suggested_fields, validation)
    _normalize_sowing_method_enrichment_fields(culture, suggested_fields, evidence, validation)
    _apply_method_seed_rates_to_suggestions(suggested_fields, validation)
    _enforce_supplier_first_output(culture, suggested_fields, evidence, validation)
    _apply_source_weighted_confidence(culture, suggested_fields, evidence)
    enrichment_finalize.ensure_supplier_product_error(evidence, validation)

    suggested_fields = enrichment_finalize.apply_complete_mode_filter(
        mode=mode,
        culture=culture,
        suggested_fields=suggested_fields,
        validation=validation,
        is_missing_culture_field=_is_missing_culture_field,
        missing_enrichment_fields=_missing_enrichment_fields,
    )

    enrichment_finalize.maybe_default_harvest_method(culture, suggested_fields, validation)

    enrichment_finalize.extend_plausibility_warnings(
        culture,
        suggested_fields,
        validation,
        _compute_plausibility_warnings,
    )

    enrichment_postprocess.cleanup_validation_warnings(validation, suggested_fields)

    result = enrichment_finalize.build_result_payload(
        culture=culture,
        mode=mode,
        provider=provider,
        suggested_fields=suggested_fields,
        evidence=evidence,
        structured_sources=structured_sources,
        validation=validation,
        usage=usage,
        cost_estimate=cost_estimate,
    )
    _persist_accounting_run(culture, mode, result)
    return result
