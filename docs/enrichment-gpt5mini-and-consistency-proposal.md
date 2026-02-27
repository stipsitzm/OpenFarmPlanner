# Short Proposal: GPT-5 Mini Default + Agronomic Consistency Hardening

## 1) Model configuration analysis
- Current provider selection uses `AI_ENRICHMENT_PROVIDER` and `OPENAI_API_KEY`.
- OpenAI model is currently hardcoded in `OpenAIResponsesProvider.model_name`.
- Batch endpoint summary also hardcodes model label in response aggregation.

## 2) Proposed clean, backward-compatible model switch
- Introduce `AI_ENRICHMENT_MODEL` setting/env in `config/settings.py`.
- Default `AI_ENRICHMENT_MODEL` to `gpt-5-mini`.
- Keep provider as `openai_responses` by default (no architecture changes).
- In provider init, resolve model from settings with fallback to `gpt-5-mini`.
- Keep behavior configurable so deployments can opt into higher-tier models via env override.

## 3) Functional hardening changes
- Keep `harvest_method` as required yield context for `expected_yield` suggestions.
- Add post-enrichment consistency checks for:
  - spacing vs inferred plant density
  - seed-rate + TKG derived seed density plausibility
  - yield magnitude vs resolved context
- Contradictions become structured validation warnings/errors; never silent corrections.

## 4) Source transparency & notes
- For all numeric suggestions, require traceable evidence metadata (URL + claim summary) or mark as `needs confirmation`.
- Generate a deterministic notes traceability section that maps numeric fields to sources and flags calculations/conversions.
- Keep existing structured sources and deduplication, but enrich notes with per-value source mapping.

## 5) Compatibility
- No DB migration.
- Existing API shape remains stable (`validation.warnings/errors`, `suggested_fields`, `evidence`).
- Default model changes to GPT-5 Mini but remains fully configurable via environment.
