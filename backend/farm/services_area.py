"""Area calculation helpers for planting plans."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce

from .models import Bed, PlantingPlan



def calculate_remaining_bed_area(
    *,
    bed_id: int,
    start_date: date,
    end_date: date,
    exclude_plan_id: int | None = None,
) -> dict[str, Decimal | int]:
    """Calculate remaining bed area for a given time interval.

    :param bed_id: ID of the bed to evaluate.
    :param start_date: Inclusive start date of the target interval.
    :param end_date: Inclusive end date of the target interval.
    :param exclude_plan_id: Optional planting plan ID to exclude from overlap calculations.
    :return: Dictionary containing bed ID, total bed area, overlapping used area, and remaining area.
    """
    if end_date < start_date:
        raise ValueError('end_date must be greater than or equal to start_date.')

    plans = PlantingPlan.objects.filter(
        bed_id=bed_id,
        planting_date__lte=end_date,
        harvest_end_date__gte=start_date,
    )
    if exclude_plan_id is not None:
        plans = plans.exclude(pk=exclude_plan_id)

    overlapping_used_area = plans.aggregate(
        total=Coalesce(Sum('area_usage_sqm'), Decimal('0.00'))
    )['total']

    if overlapping_used_area is None:
        overlapping_used_area = Decimal('0.00')

    bed_area = Bed.objects.only('area_sqm').get(pk=bed_id).area_sqm
    bed_area_decimal = bed_area if bed_area is not None else Decimal('0.00')
    remaining_area = bed_area_decimal - overlapping_used_area
    if remaining_area < Decimal('0.00'):
        remaining_area = Decimal('0.00')

    return {
        'bed_id': bed_id,
        'bed_area_sqm': bed_area_decimal,
        'overlapping_used_area_sqm': overlapping_used_area,
        'remaining_area_sqm': remaining_area,
    }
