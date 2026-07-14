"""Seed demand calculation.

For every culture with at least one planting plan in a project, computes the
total seed requirement across all its plans (rate x area / lfm / plant count,
plus a per-cultivation-type safety margin and an optional germination-rate
adjustment), normalizes it to grams via thousand-kernel-weight (TKG), and
suggests a package combination from the selected supplier's packaging sizes.

The step-by-step calculation, worked examples, and edge cases are documented
in docs/seed-demand-calculation.md - keep that file in sync when changing
behavior here. The HTTP layer (request parsing, serialization, the supplier
selection POST) lives in farm.cultures.views.SeedDemandListView.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from farm.models import Culture, CultureSupplierData, PlantingPlan, Project
from farm.seed_units import (
    SEED_PACKAGE_UNIT_GRAMS,
    SEED_PACKAGE_UNIT_SEEDS,
    SEED_RATE_UNIT_G_PER_LFM,
    SEED_RATE_UNIT_G_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_LFM,
    SEED_RATE_UNIT_SEEDS_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_PLANT,
    are_units_convertible,
    grams_to_seeds,
    seeds_to_grams,
)
from farm.services.seed_packages import PackageOption, compute_seed_package_suggestion

REQUIRED_AMOUNT_WARNING_MISSING_TKG = 'missing_tkg'


def parse_selected_suppliers(raw_value: str | None) -> dict[int, int]:
    """Parse the ``supplier_selection`` query param (``cultureId:supplierId,...``)."""
    selected: dict[int, int] = {}
    if not raw_value:
        return selected
    for item in raw_value.split(','):
        if ':' not in item:
            continue
        culture_raw, supplier_raw = item.split(':', 1)
        try:
            culture_id = int(culture_raw.strip())
            supplier_id = int(supplier_raw.strip())
        except (TypeError, ValueError):
            continue
        if culture_id > 0 and supplier_id > 0:
            selected[culture_id] = supplier_id
    return selected


def select_seed_rate(
    culture: Culture,
    cultivation_type: str | None,
) -> tuple[Decimal | None, str | None]:
    """Pick the seed rate for a plan's cultivation type.

    Precedence: the cultivation-type-specific fields (direct sowing /
    pre-cultivation), then the ``seed_rate_by_cultivation`` JSON map, then the
    legacy single rate field. A plan whose cultivation type is set but not
    among the culture's enabled ``cultivation_types`` gets no rate at all.
    """
    active_types = set(culture.cultivation_types or [])
    if cultivation_type and active_types and cultivation_type not in active_types:
        return None, None
    if (
        cultivation_type == 'direct_sowing'
        and culture.seed_rate_direct_value is not None
        and culture.seed_rate_direct_unit
    ):
        return Decimal(str(culture.seed_rate_direct_value)), culture.seed_rate_direct_unit
    if (
        cultivation_type == 'pre_cultivation'
        and culture.seed_rate_pre_cultivation_value is not None
        and culture.seed_rate_pre_cultivation_unit
    ):
        return (
            Decimal(str(culture.seed_rate_pre_cultivation_value)),
            culture.seed_rate_pre_cultivation_unit,
        )
    if cultivation_type and isinstance(culture.seed_rate_by_cultivation, dict):
        payload = culture.seed_rate_by_cultivation.get(cultivation_type)
        if isinstance(payload, dict):
            value = payload.get('value')
            unit = payload.get('unit')
            if isinstance(value, int | float | str) and unit:
                return Decimal(str(value)), str(unit)
    if culture.seed_rate_value is None or not culture.seed_rate_unit:
        return None, None
    return Decimal(str(culture.seed_rate_value)), culture.seed_rate_unit


def select_safety_margin_percent(culture: Culture, cultivation_type: str | None) -> Decimal:
    """Pick the safety-margin percentage with the same per-cultivation-type
    precedence as :func:`select_seed_rate`."""
    active_types = set(culture.cultivation_types or [])
    if cultivation_type and active_types and cultivation_type not in active_types:
        return Decimal('0')
    if (
        cultivation_type == 'direct_sowing'
        and culture.sowing_calculation_safety_percent_direct is not None
    ):
        return Decimal(str(culture.sowing_calculation_safety_percent_direct))
    if (
        cultivation_type == 'pre_cultivation'
        and culture.sowing_calculation_safety_percent_pre_cultivation is not None
    ):
        return Decimal(str(culture.sowing_calculation_safety_percent_pre_cultivation))
    return Decimal(str(culture.sowing_calculation_safety_percent or 0))


def convert_requirement_to_unit(
    *,
    requirement_value: Decimal,
    requirement_unit: str,
    target_unit: str,
    tkg: Decimal | None,
) -> tuple[Decimal | None, str | None]:
    """Convert between grams and seed count via TKG; returns (value, warning)."""
    if requirement_unit == target_unit:
        return requirement_value, None
    if not tkg or tkg <= 0:
        return None, 'Missing thousand-kernel weight for unit conversion.'
    if not are_units_convertible(requirement_unit, target_unit):
        return None, 'Cannot convert between required amount and package unit.'
    if requirement_unit == SEED_PACKAGE_UNIT_SEEDS and target_unit == SEED_PACKAGE_UNIT_GRAMS:
        return seeds_to_grams(requirement_value, tkg), None
    if requirement_unit == SEED_PACKAGE_UNIT_GRAMS and target_unit == SEED_PACKAGE_UNIT_SEEDS:
        return grams_to_seeds(requirement_value, tkg), None
    return None, 'Cannot convert between required amount and package unit.'


def get_required_amount_in_unit(
    *,
    amounts_by_unit: dict[str, Decimal],
    target_unit: str,
    tkg: Decimal | None,
) -> tuple[Decimal | None, str | None]:
    """Sum per-unit amounts into ``target_unit``, converting via TKG where needed."""
    total = amounts_by_unit.get(target_unit, Decimal('0'))
    for source_unit, source_amount in amounts_by_unit.items():
        if source_unit == target_unit or source_amount <= 0:
            continue
        converted, conversion_warning = convert_requirement_to_unit(
            requirement_value=source_amount,
            requirement_unit=source_unit,
            target_unit=target_unit,
            tkg=tkg,
        )
        if converted is None:
            if {source_unit, target_unit} == {SEED_PACKAGE_UNIT_SEEDS, SEED_PACKAGE_UNIT_GRAMS}:
                return None, REQUIRED_AMOUNT_WARNING_MISSING_TKG
            return None, conversion_warning
        total += converted
    return total, None


def select_tkg(
    culture_tkg: Decimal | None,
    selected_supplier: CultureSupplierData | None,
) -> Decimal | None:
    """The selected supplier's TKG overrides the culture's own TKG."""
    if selected_supplier and selected_supplier.thousand_kernel_weight_g:
        return Decimal(str(selected_supplier.thousand_kernel_weight_g))
    return culture_tkg


def apply_germination_rate(
    amounts_by_unit: dict[str, Decimal],
    germination_rate: float | None,
) -> dict[str, Decimal]:
    """Inflate raw seed-amount requirements to account for expected
    germination loss: a germination_rate of e.g. 80 means only 80% of
    sown seed is expected to produce a viable plant, so the raw
    requirement is scaled up by 100/germination_rate to still end up with
    enough plants. An unknown, zero, or out-of-range rate (the model only
    validates 0-100) leaves amounts unadjusted rather than raising, since
    germination_rate is optional per-supplier data. See
    docs/seed-demand-calculation.md.
    """
    if germination_rate is None or germination_rate <= 0 or germination_rate > 100:
        return amounts_by_unit
    factor = Decimal('100') / Decimal(str(germination_rate))
    return {unit: amount * factor for unit, amount in amounts_by_unit.items()}


def compute_plan_requirement(plan: PlantingPlan) -> tuple[Decimal | None, str | None]:
    """Compute one plan's raw seed requirement; returns (value, unit) on
    success or (None, warning) when a precondition is missing."""
    value, unit = select_seed_rate(plan.culture, plan.cultivation_type)
    if value is None or not unit or value <= 0:
        return None, 'Missing seed rate value or unit.'

    area = Decimal(str(plan.area_usage_sqm or 0))
    quantity = Decimal(str(plan.quantity or 0))
    row_spacing = Decimal(str(plan.culture.row_spacing_m or 0))

    if unit in {SEED_RATE_UNIT_G_PER_M2, SEED_RATE_UNIT_SEEDS_PER_M2}:
        if area <= 0:
            return None, 'Missing area usage for m²-based seed requirement.'
        amount_unit = (
            SEED_PACKAGE_UNIT_GRAMS if unit == SEED_RATE_UNIT_G_PER_M2 else SEED_PACKAGE_UNIT_SEEDS
        )
        return area * value, amount_unit

    if unit in {SEED_RATE_UNIT_G_PER_LFM, SEED_RATE_UNIT_SEEDS_PER_LFM}:
        if row_spacing <= 0:
            return None, 'Missing row spacing for lfm-based seed requirement.'
        if area <= 0:
            return None, 'Missing area usage for lfm-based seed requirement.'
        lfm = area / row_spacing
        amount_unit = (
            SEED_PACKAGE_UNIT_GRAMS if unit == SEED_RATE_UNIT_G_PER_LFM else SEED_PACKAGE_UNIT_SEEDS
        )
        return lfm * value, amount_unit

    if unit == SEED_RATE_UNIT_SEEDS_PER_PLANT:
        if quantity <= 0:
            return None, 'Missing plant quantity for seeds-per-plant requirement.'
        return quantity * value, 'seeds'

    return None, 'Unsupported seed rate unit.'


def _aggregate_requirements_by_culture(project: Project) -> dict[int, dict]:
    """Group all of a project's plans by culture and sum margin-adjusted
    requirements into per-unit buckets (grams and seeds separately)."""
    plans = (
        PlantingPlan.objects
        .filter(project=project)
        .select_related(
            'culture', 'culture__supplier', 'culture__selected_seed_demand_supplier',
        )
        .order_by('culture__name', 'culture__variety')
    )
    grouped: dict[int, dict] = {}
    for plan in plans:
        culture = plan.culture
        entry = grouped.setdefault(
            culture.id,
            {
                'culture_id': culture.id,
                'culture_name': culture.name,
                'variety': culture.variety,
                'supplier': (
                    culture.supplier.name if culture.supplier else (culture.seed_supplier or '')
                ),
                'required_amount_by_unit': {
                    SEED_PACKAGE_UNIT_GRAMS: Decimal('0'),
                    SEED_PACKAGE_UNIT_SEEDS: Decimal('0'),
                },
                'warning': None,
                'tkg': (
                    Decimal(str(culture.thousand_kernel_weight_g))
                    if culture.thousand_kernel_weight_g
                    else None
                ),
                'culture': culture,
            },
        )
        # Once one plan for this culture fails to compute a requirement, every
        # later plan for the same culture is skipped too (not just the failing
        # one) — the row shows a single warning rather than a partial total
        # that would understate demand without saying so. See
        # docs/seed-demand-calculation.md.
        if entry['warning']:
            continue
        requirement_value, requirement_unit = compute_plan_requirement(plan)
        if requirement_value is None or not requirement_unit:
            entry['warning'] = requirement_unit or 'Seed requirement could not be calculated.'
            continue
        margin_factor = Decimal('1') + (
            select_safety_margin_percent(culture, plan.cultivation_type) / Decimal('100')
        )
        entry['required_amount_by_unit'][requirement_unit] += requirement_value * margin_factor
    return grouped


def _resolve_selected_supplier(
    *,
    culture: Culture,
    supplier_options: list[CultureSupplierData],
    requested_supplier_id: int | None,
) -> CultureSupplierData | None:
    """Resolve the supplier whose data drives the calculation.

    Precedence: explicit request (query param) > persisted
    ``selected_seed_demand_supplier`` > auto-pick when there is exactly one
    option (display-only, never persisted).
    """
    selected_supplier_id = requested_supplier_id
    if selected_supplier_id is None:
        selected_supplier_id = culture.selected_seed_demand_supplier_id
    if selected_supplier_id:
        selected = next(
            (item for item in supplier_options if item.supplier_id == selected_supplier_id),
            None,
        )
        if selected is not None:
            return selected
    if len(supplier_options) == 1:
        return supplier_options[0]
    return None


def _valid_packages(selected_supplier: CultureSupplierData | None) -> list[dict]:
    packages: list[dict] = []
    for item in (selected_supplier.packaging_sizes if selected_supplier else None) or []:
        if not isinstance(item, dict):
            continue
        size_value = item.get('size_value')
        size_unit = item.get('size_unit')
        if not isinstance(size_value, int | float) or size_unit not in {
            SEED_PACKAGE_UNIT_GRAMS,
            SEED_PACKAGE_UNIT_SEEDS,
        }:
            continue
        packages.append({'size_value': float(size_value), 'size_unit': size_unit})
    return packages


def build_seed_demand_rows(
    *,
    project: Project,
    selected_supplier_by_culture: dict[int, int],
) -> list[dict]:
    """Build the display-ready seed-demand rows for a project, one per culture."""
    grouped = _aggregate_requirements_by_culture(project)

    supplier_rows = (
        CultureSupplierData.objects
        .filter(project=project, culture_id__in=list(grouped.keys()))
        .select_related('supplier')
        .order_by('culture_id', 'supplier__name')
    )
    suppliers_map: dict[int, list[CultureSupplierData]] = defaultdict(list)
    for supplier_row in supplier_rows:
        suppliers_map[supplier_row.culture_id].append(supplier_row)

    rows: list[dict] = []
    for culture_id, entry in grouped.items():
        required_amounts_by_unit = entry['required_amount_by_unit']
        has_required_amount = any(amount > 0 for amount in required_amounts_by_unit.values())
        warning = entry['warning']
        culture = entry['culture']
        supplier_options = suppliers_map.get(culture_id, [])
        selected_supplier = _resolve_selected_supplier(
            culture=culture,
            supplier_options=supplier_options,
            requested_supplier_id=selected_supplier_by_culture.get(culture_id),
        )

        selected_tkg = select_tkg(entry['tkg'], selected_supplier)
        germination_rate = selected_supplier.germination_rate if selected_supplier else None
        germination_adjusted_amounts = apply_germination_rate(
            required_amounts_by_unit, germination_rate,
        )
        display_required_amount, required_amount_warning = get_required_amount_in_unit(
            amounts_by_unit=germination_adjusted_amounts,
            target_unit=SEED_PACKAGE_UNIT_GRAMS,
            tkg=selected_tkg,
        )
        packages = _valid_packages(selected_supplier)
        row = {
            'culture_id': entry['culture_id'],
            'culture_name': entry['culture_name'],
            'variety': entry['variety'],
            'supplier': (
                selected_supplier.supplier.name
                if selected_supplier and selected_supplier.supplier
                else (selected_supplier.supplier_name if selected_supplier else '')
            ),
            'selected_supplier_id': selected_supplier.supplier_id if selected_supplier else None,
            'supplier_options': [
                {
                    'supplier_id': item.supplier_id,
                    'supplier_name': item.supplier.name if item.supplier else item.supplier_name,
                }
                for item in supplier_options
            ],
            'required_amount_value': (
                float(display_required_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                if display_required_amount is not None
                else None
            ),
            'required_amount_unit': SEED_PACKAGE_UNIT_GRAMS if has_required_amount else None,
            'required_amount_warning': required_amount_warning,
            'total_grams': (
                float(display_required_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                if display_required_amount is not None
                else None
            ),
            'seed_packages': packages,
            'package_suggestion': None,
            'packages_needed': None,
            'warning': warning,
        }
        if not supplier_options:
            row['warning'] = row['warning'] or 'Keine Lieferantendaten vorhanden.'

        if warning or not has_required_amount or not packages:
            rows.append(row)
            continue

        target_unit = (
            SEED_PACKAGE_UNIT_GRAMS
            if any(pkg['size_unit'] == SEED_PACKAGE_UNIT_GRAMS for pkg in packages)
            else packages[0]['size_unit']
        )
        same_unit_packages = [pkg for pkg in packages if pkg['size_unit'] == target_unit]
        target_amount, conversion_warning = get_required_amount_in_unit(
            amounts_by_unit=germination_adjusted_amounts,
            target_unit=target_unit,
            tkg=selected_tkg,
        )
        if target_amount is None:
            row['warning'] = (
                conversion_warning or 'Cannot convert required amount to package units.'
            )
            rows.append(row)
            continue

        suggestion = compute_seed_package_suggestion(
            required_amount=target_amount,
            packages=[
                PackageOption(
                    size_value=Decimal(str(pkg['size_value'])),
                    size_unit=pkg['size_unit'],
                )
                for pkg in same_unit_packages
            ],
            unit=target_unit,
        )
        if suggestion.pack_count > 0:
            row['package_suggestion'] = {
                'selection': [
                    {
                        'size_value': float(item.size_value),
                        'size_unit': item.size_unit,
                        'count': item.count,
                    }
                    for item in suggestion.selection
                ],
                'total_amount': float(suggestion.total_amount),
                'overage': float(suggestion.overage),
                'pack_count': suggestion.pack_count,
                'unit': target_unit,
            }
            row['packages_needed'] = suggestion.pack_count
        rows.append(row)

    rows.sort(key=lambda item: (item['culture_name'] or '', item['variety'] or ''))
    return rows
