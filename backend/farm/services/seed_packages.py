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

    best: SeedPackageSuggestion | None = None
    for counts in product(*bounds):
        total = sum((normalized[i].size_value * Decimal(counts[i]) for i in range(len(normalized))), Decimal('0'))
        if total < required_amount:
            continue
        pack_count = sum(counts)
        overage = total - required_amount
        selection = [
            PackageSelection(size_value=normalized[i].size_value, size_unit=normalized[i].size_unit, count=counts[i])
            for i in range(len(normalized)) if counts[i] > 0
        ]
        candidate = SeedPackageSuggestion(selection=selection, total_amount=total, overage=overage, pack_count=pack_count)
        if best is None:
            best = candidate
            continue

        # Lexicographic objective: overage, pack_count, larger packs
        larger_score = tuple(sorted((item.size_value for item in selection), reverse=True))
        best_score = tuple(sorted((item.size_value for item in best.selection), reverse=True))
        cand_key = (candidate.overage, candidate.pack_count, tuple(-v for v in larger_score))
        best_key = (best.overage, best.pack_count, tuple(-v for v in best_score))
        if cand_key < best_key:
            best = candidate

    return best or SeedPackageSuggestion(selection=[], total_amount=Decimal('0'), overage=Decimal('0'), pack_count=0)
