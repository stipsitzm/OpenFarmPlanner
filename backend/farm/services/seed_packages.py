from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
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


def _metrics_sort_key(metrics: _SuggestionMetrics) -> tuple[Decimal, int, int, int, int, Decimal, tuple[Decimal, ...]]:
    return (
        metrics.weighted_score,
        metrics.pack_count,
        metrics.excessive_small_pack_count,
        metrics.small_pack_count,
        metrics.distinct_sizes,
        metrics.overage,
        tuple(-value for value in metrics.larger_pack_bias),
    )


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

    unique_packages: dict[tuple[Decimal, str], PackageOption] = {}
    for package in packages:
        if package.size_unit != unit or package.size_value <= 0:
            continue
        unique_packages[(package.size_value, package.size_unit)] = package

    normalized = list(unique_packages.values())
    if not normalized:
        return SeedPackageSuggestion(selection=[], total_amount=Decimal('0'), overage=Decimal('0'), pack_count=0)

    normalized.sort(key=lambda p: p.size_value)
    min_pack_count = int((required_amount / normalized[-1].size_value).to_integral_value(rounding=ROUND_CEILING))
    max_pack_count = int((required_amount / normalized[0].size_value).to_integral_value(rounding=ROUND_CEILING)) + 2

    smallest_size = normalized[0].size_value
    best: SeedPackageSuggestion | None = None
    best_metrics: _SuggestionMetrics | None = None

    def count_vectors(total_count: int, dimension_count: int) -> Iterable[list[int]]:
        current = [0] * dimension_count

        def build(index: int, remaining: int) -> Iterable[list[int]]:
            if index == dimension_count - 1:
                current[index] = remaining
                yield current.copy()
                return
            for count in range(remaining + 1):
                current[index] = count
                yield from build(index + 1, remaining - count)

        yield from build(0, total_count)

    for pack_count in range(max(1, min_pack_count), max_pack_count + 1):
        for counts in count_vectors(pack_count, len(normalized)):
            total = sum((normalized[i].size_value * Decimal(counts[i]) for i in range(len(normalized))), Decimal('0'))
            if total < required_amount:
                continue
            overage = total - required_amount
            selection = [
                PackageSelection(size_value=normalized[i].size_value, size_unit=normalized[i].size_unit, count=counts[i])
                for i in range(len(normalized)) if counts[i] > 0
            ]
            candidate = SeedPackageSuggestion(selection=selection, total_amount=total, overage=overage, pack_count=pack_count)
            metrics = _build_metrics(selection=selection, overage=overage, smallest_size=smallest_size)
            if best is None:
                best = candidate
                best_metrics = metrics
                continue

            cand_key = _metrics_sort_key(metrics)
            assert best_metrics is not None  # for type checkers; best and best_metrics are paired.
            best_key = _metrics_sort_key(best_metrics)
            if cand_key < best_key:
                best = candidate
                best_metrics = metrics

        if best_metrics is not None:
            lower_bound_next_pack_count = Decimal((pack_count + 1) * 4 + 1)
            if lower_bound_next_pack_count > best_metrics.weighted_score:
                break

    return best or SeedPackageSuggestion(selection=[], total_amount=Decimal('0'), overage=Decimal('0'), pack_count=0)
