# Seed Demand Calculation (Saatgutbedarf)

The Seed Demand page (`/app/seed-demand`, `frontend/src/pages/SeedDemand.tsx`)
answers: *for each culture, across all its planting plans in the active
project, how much seed do we need, and how many packages (of which sizes)
should we buy?*

**The calculation happens entirely on the backend.** The frontend only
renders the result and lets the user pick a supplier per culture.

## Purpose and user interaction

One row per culture, aggregated across every planting plan of that culture
in the project — there's no per-plan or per-project drill-down UI. The only
interaction that changes the underlying data is choosing a supplier from a
per-row dropdown (only shown when a culture has more than one supplier with
seed data); everything else (amount, package suggestion) is read-only,
computed server-side. `frontend/src/pages/requirementFlow.ts`, despite the
name, is *not* part of the calculation — it only decides which "you're
missing setup step X" empty-state card to show when the project has no
fields/beds/cultures/plans yet.

## Where the logic lives

| Piece | File |
|---|---|
| Per-plan requirement + aggregation + supplier/TKG resolution | `backend/farm/views.py`, `SeedDemandListView` (`GET`/`POST /seed-demand/`) |
| Package-count optimizer | `backend/farm/services/seed_packages.py`, `compute_seed_package_suggestion()` |
| Unit constants (seed-rate units, package units) | `backend/farm/seed_units.py` |
| Read-only response shape | `backend/farm/serializers.py`, `SeedDemandSerializer` |
| Display + supplier selection UI | `frontend/src/pages/SeedDemand.tsx` |

## Calculation, step by step

For each culture with at least one planting plan:

1. **Per-plan requirement.** Pick the seed rate for the plan's
   `cultivation_type` (direct sowing vs. pre-cultivation have separate rate
   fields; falls back to a generic `seed_rate_by_cultivation` map, then to a
   legacy single rate field). Convert to a quantity using whichever unit the
   rate is expressed in:
   - `g_per_m2` / `seeds_per_m2` → `plan.area_usage_sqm × rate`
   - `g_per_lfm` / `seeds_per_lfm` → `(area_usage_sqm / culture.row_spacing_m) × rate`
   - `seeds_per_plant` → `plan.quantity × rate`

   If the plan's `cultivation_type` is set but isn't (or is no longer) one of
   the culture's enabled `cultivation_types`, the plan is silently excluded
   from the rate lookup.

2. **Safety margin.** A per-cultivation-type safety-margin percentage
   (`sowing_calculation_safety_percent_direct` / `_pre_cultivation`, or a
   generic fallback) is applied **per plan, before summing**:
   `required += requirement × (1 + margin_percent / 100)`.

3. **Sum across all of a culture's plans**, keeping grams and seed-count
   totals in separate buckets (a culture can have plans using either unit).
   **Important quirk**: if any single plan fails to compute a requirement
   (missing row spacing, missing quantity, etc.), the *entire culture's row*
   for that request stops accumulating further plans — one bad plan doesn't
   just get skipped, it poisons the rest of that culture's total for this
   request.

4. **Supplier resolution**, in priority order: an explicit
   `?supplier_selection=cultureId:supplierId` query param (read-only, used
   by the same GET that also displays the result) → the persisted
   `culture.selected_seed_demand_supplier` → if there's exactly one supplier
   option, auto-use it for display **without persisting it** (confirmed by
   a dedicated regression test — see below).

5. **Thousand-kernel-weight (TKG) resolution**: the *selected supplier's*
   `CultureSupplierData.thousand_kernel_weight_g` takes priority over the
   *culture's own* `thousand_kernel_weight_g`. Changing the selected
   supplier can therefore change the effective TKG, and with it both the
   displayed gram total and the package suggestion — this is intentional,
   not a bug, if a value looks like it "changed for no reason" after a
   supplier switch.

6. **Display amount** is always normalized to grams via the TKG conversion
   above. If the native rate was in seeds and no TKG is available anywhere,
   the amount can't be computed: `required_amount_value = None`,
   `required_amount_warning = 'missing_tkg'` — the UI shows a specific
   "missing TKG" message instead of `0` or a dash.

7. **Package suggestion** (`compute_seed_package_suggestion`): only
   attempted if the selected supplier has `packaging_sizes`. Converts the
   required amount into whichever unit the packages use (grams preferred if
   any package is in grams), then searches combinations of pack counts for
   one that **always rounds up** to at least the required amount — no
   fractional packages are ever suggested. Among valid combinations, it
   prefers (in order): fewer total packages, fewer/no "excessive" small
   packages, fewer distinct sizes, and only then minimal overage — a
   scoring tradeoff, not a pure "minimize waste" search. If package sizing
   uses a *different* unit than the native seed-rate unit and no TKG is
   available for that conversion, `required_amount_value` can be `None`
   while a `package_suggestion` is still present (or vice versa) — this
   inconsistent-looking pairing is expected, see the "missing TKG" example
   below.

## Worked examples (from `backend/farm/tests/test_seed_demand.py`)

**A — safety margin, single package size ("Carrot").**
Seed rate `10 g/m²`, safety margin `10%` (direct sowing). Two planting
plans, 5 m² each → 10 m² total.
`10 m² × 10 g/m² = 100 g`, `× 1.10 = 110 g` → `required_amount_value = 110.0`.
Supplier package: 25 g each → `ceil(110 / 25) = 5` packages (125 g total,
15 g overage).

**B — cross-unit conversion via TKG ("Spinach").**
Seed rate `20 g/m²`, no margin, 5 m² → `100 g` required.
Culture's own TKG = 10 g/1000 seeds, but the **selected supplier's**
`thousand_kernel_weight_g = 2` — this overrides the culture's TKG.
Supplier packages are sized in **seeds** (5000/pack), so the 100 g
requirement is converted to seed count using the supplier's TKG:
`100 g / 2 g × 1000 = 50,000 seeds` → `ceil(50000 / 5000) = 10` packages.
This is the clearest example of "supplier TKG overrides culture TKG,"
because the same 100 g requirement would need a very different package
count with the culture's own TKG of 10.

**C — missing TKG ("Beetroot" / "Kresse").**
Seed rate is `seeds_per_m2`, but no TKG exists anywhere (neither culture nor
supplier). Result: `required_amount_value = None`,
`required_amount_unit = 'g'` (the display unit is fixed even though the
value couldn't be computed), `required_amount_warning = 'missing_tkg'`. A
package suggestion can *still* be produced if the supplier's packages are
sized directly in seeds (no conversion needed) — so it's normal to see a
package suggestion next to a "missing TKG" warning in the same row.

## Edge cases

- **No supplier data at all** → warning `"Keine Lieferantendaten
  vorhanden."`, no package suggestion; the UI links to editing the culture.
- **Multiple suppliers, none selected** → the frontend forces an explicit
  choice; nothing is auto-computed or persisted until the user picks one.
- **Exactly one supplier** → auto-used for the calculation but never
  written to the database (there's no interaction available to trigger a
  write in that state anyway).
- **`CultureSupplierData.germination_rate` is stored but currently
  unused** in the quantity calculation — worth knowing if you're asked to
  "why doesn't a low germination rate increase the suggested amount," since
  the field exists but isn't wired into this formula.
- **Historical package-size changes are not considered.** The calculation
  always reads the *current* `CultureSupplierData.packaging_sizes` and
  current culture/supplier fields — `CultureRevision` (deprecated, see
  [versioning-and-history.md](./versioning-and-history.md)) is not consulted,
  so there's no point-in-time "what would this have cost last season"
  calculation.

## A known internal inconsistency (documented, not hidden)

`backend/farm/seed_units.py` defines reusable conversion helpers
(`seeds_to_grams`, `grams_to_seeds`, `are_units_convertible`) that implement
the same TKG formula described above — but the actual runtime conversion
path in `SeedDemandListView` is a hand-rolled duplicate of that formula
inline in the view, not a call to these functions. The formulas agree today,
but if you need to change the conversion formula, **both places must be
updated together**, or better: refactor the view to call the shared helper
instead of leaving the duplication in place.

## Unclear / needs check

- Whether `germination_rate` is intended to factor into required-amount
  math in a future iteration, or is deliberately display-only for now.
