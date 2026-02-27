# Culture Enrichment – Phase 1 Findings & Proposal

## Findings (current architecture)

### Backend pipeline location
- Enrichment core lives in `backend/farm/services/enrichment.py`.
  - Provider prompt + parsing: `OpenAIResponsesProvider`.
  - Normalization/filtering: `_normalize_choice_value`, `_is_missing_culture_field`, `enrich_culture`.
  - Notes merge/render: `_note_blocks_to_markdown`, `build_note_appendix`.
- API endpoints are in `backend/farm/views.py`:
  - `POST /cultures/{id}/enrich/`
  - `POST /cultures/enrich-batch/`
- Culture persistence/validation is centered in:
  - `backend/farm/models.py` (`Culture.clean`)
  - `backend/farm/serializers.py` (`CultureSerializer.validate` + model clean invocation)

### Frontend suggestion flow
- API client methods: `frontend/src/api/api.ts` (`cultureAPI.enrich`, `enrichBatch`).
- Suggestion review + apply dialog: `frontend/src/pages/Cultures.tsx`.
- `suggested_fields` are checked by default; apply action writes selected values via `cultureAPI.update`.

### Current validation/normalization gaps
- `expected_yield` has value validation, but unit semantics are not first-class and can be ambiguous.
- Enum normalization exists for `cultivation_type` + `nutrient_demand`; `harvest_method` was added recently but still needs stronger completeness rules.
- No dedicated plausibility engine step after enrichment (derived density/TKG/evidence confidence checks are limited).
- Evidence in response is field-scoped, but source taxonomy (variety-specific vs general) is not a dedicated structured artifact.

## Recommended schema changes

1. Keep `expected_yield` as numeric kilograms (no additional unit field).
2. Enforce consistency rules:
   - `harvest_duration_days` requires `harvest_method`.
   - `seeding_requirement_type` must be set iff `seeding_requirement` is set.

## Validation ownership

### Model/serializer level (hard rules)
- Non-negative numeric checks (already present).
- Cross-field consistency (unit required, enum consistency).
- Reject invalid enum values and unsupported units.

### Enrichment layer (soft checks + warnings)
- Normalize aliases and units.
- Drop invalid suggestions with explicit warnings.
- Generate plausibility warnings without silent overwrite.
- Add evidence-required warnings for borderline values.

## Plausibility & Completeness proposal

Implement a post-enrichment plausibility stage:

1. Derived metric:
   - `plants_per_m2 = seed_rate_value (seeds/m) * (100 / row_spacing_cm)`.
2. Crop-group configurable ranges (generic + group-specific overrides):
   - `default`, `legume_bush` (beans/bush-beans) etc.
3. Warning-only behavior:
   - Out-of-range density => warning (no auto-correct).
   - Borderline TKG => warning + "needs confirmation" when evidence is weak.
4. Completeness check:
   - For `complete` mode, report unresolved missing fields explicitly.

## Evidence/source handling proposal

Produce structured source metadata from field evidence:

```json
[
  {
    "title": "...",
    "url": "...",
    "type": "variety_specific|general_crop",
    "retrieved_at": "...",
    "claim_summary": "..."
  }
]
```

Notes rendering should generate:
- `## Quellen`
  - `### Sortenspezifische Quellen`
  - `### Allgemeine Kulturinformationen`

with deduplication by `(url, title)`.

## Test plan

1. Enrichment service tests:
- expected_yield is treated as kilograms in UI and enrichment notes.
- harvest_method fallback/validation in complete mode.
- derived density warning (low/high).
- TKG borderline warning + evidence-required flag.
- structured sources classification + dedup.

2. Serializer/model tests:
- cross-field consistency rules.

3. Frontend tests/build checks:
- warning visibility in suggestion dialog.
- unit display for expected_yield.

## Migration considerations

- No schema migration required for yield units.
- Keep existing numeric data backward-compatible.
