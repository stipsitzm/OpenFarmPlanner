# Proposal: Yield Context, Plausibility, and Evidence Hardening for Enrichment

## Scope
This proposal covers the culture enrichment flow end-to-end with a focus on:
- `expected_yield` context consistency (`per_plant` vs `per_sqm`)
- post-enrichment plausibility checks
- stronger evidence requirements for high-impact fields (especially yield)
- frontend suggestion review safety for invalid suggestions

## A) Current enrichment flow (end-to-end)

### Provider and prompting
- Enrichment is implemented in `backend/farm/services/enrichment.py` via provider abstraction (`BaseEnrichmentProvider`) and currently uses OpenAI Responses (`OpenAIResponsesProvider`) with `web_search_preview` tool.
- Prompt requires strict JSON with `suggested_fields`, `evidence`, `validation`, `note_blocks`, and includes allowed enum values (including `harvest_method`).
- Provider parses model output JSON, extracts usage/cost metadata, and returns a normalized payload.

### Mapping / normalization layer
- `enrich_culture` post-processes provider output:
  - validates payload types
  - normalizes enum-like fields (`cultivation_type`, `nutrient_demand`, `harvest_method`, `seed_rate_unit`)
  - validates seed package suggestions
  - computes plausibility warnings (currently only density + TKG checks)
  - builds `structured_sources` and appends source markdown into notes
  - in `complete` mode keeps only fields that are currently missing

### Model / serializer validation
- `Culture.expected_yield` is `DecimalField(max_digits=10, decimal_places=2)` and only validated as non-negative in model clean.
- `harvest_method` is a choice field (`per_plant`, `per_sqm`), but no hard linkage to `expected_yield` context validity beyond general form-level usage.
- Serializer validation currently enforces some cross-field rules (e.g., harvest duration needs harvest method) but does not enforce yield-context ambiguity handling or plausibility ranges.

### Enrichment endpoints
- Single run: `POST /cultures/{id}/enrich/` in `CultureViewSet.enrich`.
- Batch run: `POST /cultures/enrich-batch/` in `CultureViewSet.enrich_batch` with per-item success/failure aggregation.
- Validation warnings/errors from enrichment are returned to frontend but not used to block applying specific fields.

### Frontend review/apply flow
- `frontend/src/pages/Cultures.tsx` opens enrichment dialog, lists suggestions with checkboxes, renders warning messages, and applies selected fields via `cultureAPI.update`.
- Current behavior: errors are not rendered separately and no per-field apply-blocking exists for invalid suggestions.

### Notes / source handling
- Backend converts evidence map to `structured_sources` and appends deduplicated markdown source section.
- Deduplication is currently by `(url, title)` only.
- Claim summary is derived from snippet (fallback title).

## B) Yield representation today

- Storage: `Culture.expected_yield` (numeric) and `Culture.harvest_method` (context enum) in model.
- Effective context is inferred from `harvest_method`; there is no separate `yield_context` field.
- Frontend displays expected yield as kg and renders context text from `harvest_method`.
- Export utilities also pass through `harvest_method` + `expected_yield` as separate fields.

## C) Validation points and current gaps

### Existing validation points
- Model and serializer reject negative yield.
- Enrichment enum normalization can drop invalid `harvest_method` values.
- Current plausibility warnings are unrelated to yield magnitude/context.

### Gaps
1. Yield context ambiguity:
   - `expected_yield` can be suggested without explicit/usable context in same run.
2. Missing generic yield plausibility:
   - no hard or soft range checks for per-plant/per-area yield values.
   - no derived cross-check when spacing allows context conversion.
3. Evidence quality for yield:
   - no minimum evidence requirement for yield suggestion acceptance.
   - no differentiated handling for “overwrite existing value” risk.
4. Frontend safety:
   - invalid field suggestions are not blocked from apply.

## D) Proposed incremental design

## 1) Keep schema minimal (reuse existing context)
- Reuse `harvest_method` as the explicit yield context.
- No DB migration in this iteration.
- Introduce enrichment-layer rules to require clear context whenever `expected_yield` is suggested.

## 2) Validation ownership
- **Serializer/model**: keep fundamental domain constraints (types, non-negative values, existing cross-field rules).
- **Enrichment layer**: perform AI-output quality checks and plausibility classification (warnings/errors), including evidence checks and context ambiguity checks.

## 3) Generic plausibility framework (enrichment post-step)
Introduce a dedicated enrichment post-check routine for yield that:
- reads suggested `expected_yield` and resolves context from suggested `harvest_method` or existing culture value.
- if context missing/ambiguous: add validation error (`yield_context_missing`) and mark suggestion invalid.
- hard sanity limits (invalid):
  - per plant: value <= 0 or > high cap
  - per sqm: value <= 0 or > high cap
- typical-range warnings (plausible but unusual):
  - per plant above warning threshold
  - per sqm above warning threshold
- derived conversion checks (only if reliable input exists):
  - if spacing available, derive `plants_per_m2`
  - compare implied cross-context value and classify warning/error if extreme
  - if spacing unavailable: warn that cross-check is skipped; do not auto-convert

Result format remains in `validation.warnings` and `validation.errors` arrays.
No silent correction of values.

## 4) Evidence requirements for high-impact yield
For `expected_yield` suggestion, require at least one evidence entry with:
- `source_url` (non-empty)
- claim summary (use `snippet`, fallback `claim_summary` if present)

Behavior:
- Missing evidence + existing culture yield present: drop yield suggestion and add validation error/warning (`yield_evidence_missing_override_blocked`).
- Missing evidence + no existing yield: keep suggestion but add warning (`yield_needs_manual_confirmation`) so user can decide.

## 5) Sources / notes reliability improvements
- Improve source deduplication key to `(url, claim_summary)` fallback `(url, title)`.
- Keep deterministic markdown rendering and avoid duplicates from repeated evidence entries.

## 6) Frontend behavior changes
- Render enrichment `validation.errors` in dialog (separate alert block).
- Derive per-field invalid state from validation errors.
- Disable checkbox for invalid fields and prevent apply of invalid entries.
- Still allow applying other valid fields in same run.

## 7) Test plan

### Backend
- context handling:
  - expected_yield without any harvest method context -> error and no auto-default.
- plausibility:
  - per_sqm absurd value -> invalid error.
  - per_plant high-but-possible -> warning.
  - derived conversion only when spacing reliable.
- evidence:
  - missing evidence blocks overwrite when existing expected_yield exists.
  - missing evidence without existing value adds manual-confirm warning.
- source dedup:
  - duplicate URLs with same claim summary produce one structured source.

### Frontend
- enrichment dialog shows errors.
- invalid field checkbox disabled.
- apply action excludes invalid suggestions and still applies valid ones.

## Migration considerations
- No DB migration required in this phase.
- API response structure remains backward-compatible (`validation.errors` already exists).

