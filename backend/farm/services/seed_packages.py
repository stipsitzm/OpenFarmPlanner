from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
from itertools import product
from typing import Iterable


@dataclass(frozen=True)
class PackageOption:
    size_value: Decimal
    size_unit: str


@dataclass(frozen=True)
class PackageSelection:
    size_value: Decimal
    size_unit: str
    count: int


@dataclass(frozen=True)
class SeedPackageSuggestion:
    selection: list[PackageSelection]
    total_amount: Decimal
    overage: Decimal
    pack_count: int


@dataclass(frozen=True)
class _SuggestionMetrics:
    weighted_score: Decimal
    pack_count: int
    excessive_small_pack_count: int
    small_pack_count: int
    distinct_sizes: int
    overage: Decimal
    larger_pack_bias: tuple[Decimal, ...]


def _build_metrics(
    *,
    selection: list[PackageSelection],
    overage: Decimal,
    smallest_size: Decimal,
) -> _SuggestionMetrics:
    """
    Build deterministic optimization metrics for package suggestions.

    Priority model:
    1) Required amount is already guaranteed by caller.
    2) Fewer packs are strongly preferred.
    3) Small packs are penalized, especially if more than two are used.
    4) Fewer distinct sizes are preferred.
    5) Overage is tolerated when it simplifies the order.
    """

    pack_count = sum(item.count for item in selection)
    small_pack_count = sum(item.count for item in selection if item.size_value == smallest_size)
    excessive_small_pack_count = max(0, small_pack_count - 2)
    distinct_sizes = len(selection)

    weighted_score = (
        overage
        + Decimal(pack_count * 4)
        + Decimal(small_pack_count * 2)
        + Decimal(excessive_small_pack_count * 5)
        + Decimal(distinct_sizes)
    )
    larger_pack_bias = tuple(sorted((item.size_value for item in selection), reverse=True))
    return _SuggestionMetrics(
        weighted_score=weighted_score,
        pack_count=pack_count,
        excessive_small_pack_count=excessive_small_pack_count,
        small_pack_count=small_pack_count,
        distinct_sizes=distinct_sizes,
        overage=overage,
        larger_pack_bias=larger_pack_bias,
    )


def compute_seed_package_suggestion(required_amount: Decimal, packages: Iterable[PackageOption], unit: str) -> SeedPackageSuggestion:
    if required_amount <= 0:
        return SeedPackageSuggestion(selection=[], total_amount=Decimal('0'), overage=Decimal('0'), pack_count=0)

    normalized = [p for p in packages if p.size_unit == unit and p.size_value > 0]
    if not normalized:
        return SeedPackageSuggestion(selection=[], total_amount=Decimal('0'), overage=Decimal('0'), pack_count=0)

    normalized.sort(key=lambda p: p.size_value)
    bounds: list[range] = []
    for pkg in normalized:
        upper = int((required_amount / pkg.size_value).to_integral_value(rounding=ROUND_CEILING)) + 2
        bounds.append(range(0, upper + 1))

    smallest_size = normalized[0].size_value
    best: SeedPackageSuggestion | None = None
    best_metrics: _SuggestionMetrics | None = None
    for counts in product(*bounds):
        total = sum((normalized[i].size_value * Decimal(counts[i]) for i in range(len(normalized))), Decimal('0'))
        if total < required_amount:
            continue
        overage = total - required_amount
        selection = [
            PackageSelection(size_value=normalized[i].size_value, size_unit=normalized[i].size_unit, count=counts[i])
            for i in range(len(normalized)) if counts[i] > 0
        ]
        pack_count = sum(item.count for item in selection)
        candidate = SeedPackageSuggestion(selection=selection, total_amount=total, overage=overage, pack_count=pack_count)
        metrics = _build_metrics(selection=selection, overage=overage, smallest_size=smallest_size)
        if best is None:
            best = candidate
            best_metrics = metrics
            continue

        cand_key = (
            metrics.weighted_score,
            metrics.pack_count,
            metrics.excessive_small_pack_count,
            metrics.small_pack_count,
            metrics.distinct_sizes,
            metrics.overage,
            tuple(-v for v in metrics.larger_pack_bias),
        )
        assert best_metrics is not None  # for type checkers; best and best_metrics are paired.
        best_key = (
            best_metrics.weighted_score,
            best_metrics.pack_count,
            best_metrics.excessive_small_pack_count,
            best_metrics.small_pack_count,
            best_metrics.distinct_sizes,
            best_metrics.overage,
            tuple(-v for v in best_metrics.larger_pack_bias),
        )
        if cand_key < best_key:
            best = candidate
            best_metrics = metrics

    return best or SeedPackageSuggestion(selection=[], total_amount=Decimal('0'), overage=Decimal('0'), pack_count=0)
