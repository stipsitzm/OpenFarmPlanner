"""Accounting and usage helpers for enrichment runs."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from farm.models import Culture, EnrichmentAccountingRun

INPUT_COST_PER_MILLION = Decimal('2.00')
CACHED_INPUT_COST_PER_MILLION = Decimal('0.50')
OUTPUT_COST_PER_MILLION = Decimal('8.00')
WEB_SEARCH_CALL_COST_USD = Decimal('0.01')
TAX_RATE = Decimal('0.20')


def extract_usage(payload: dict[str, Any]) -> dict[str, int]:
    """Extract token usage values from an OpenAI Responses payload."""
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


def count_web_search_calls(payload: dict[str, Any]) -> int:
    """Count web search tool call items in a Responses payload."""
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


def build_cost_estimate(
    *,
    input_tokens: int,
    cached_input_tokens: int,
    output_tokens: int,
    web_search_call_count: int,
    model: str,
) -> dict[str, Any]:
    """Build a deterministic USD cost estimate for one enrichment invocation."""
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


def persist_accounting_run(culture: Culture, mode: str, result: dict[str, Any]) -> None:
    """Persist one accounting row for an enrichment invocation."""
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
