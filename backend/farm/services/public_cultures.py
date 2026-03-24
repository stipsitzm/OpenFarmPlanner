from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.utils import timezone

from farm.models import Culture, Project, PublicCulture

User = get_user_model()

CULTURE_COPY_FIELDS = [
    'name',
    'variety',
    'notes',
    'seed_supplier',
    'crop_family',
    'nutrient_demand',
    'cultivation_types',
    'cultivation_type',
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'harvest_method',
    'expected_yield',
    'allow_deviation_delivery_weeks',
    'distance_within_row_m',
    'row_spacing_m',
    'sowing_depth_m',
    'seed_rate_value',
    'seed_rate_unit',
    'seed_rate_by_cultivation',
    'sowing_calculation_safety_percent',
    'thousand_kernel_weight_g',
    'seeding_requirement',
    'seeding_requirement_type',
    'display_color',
]


@dataclass(frozen=True)
class DuplicateCandidate:
    id: int
    name: str
    variety: str
    version: int
    published_at: Any
    created_by_label: str


def _copy_fields(instance: Any) -> dict[str, Any]:
    payload = {field: getattr(instance, field) for field in CULTURE_COPY_FIELDS}
    payload['cultivation_types'] = list(payload.get('cultivation_types') or [])
    payload['seed_rate_by_cultivation'] = payload.get('seed_rate_by_cultivation') or None
    return payload


def _seed_packages_payload_from_culture(culture: Culture) -> list[dict[str, Any]]:
    return [
        {
            'size_value': float(package.size_value),
            'size_unit': package.size_unit,
            'evidence_text': package.evidence_text,
            'last_seen_at': package.last_seen_at.isoformat() if package.last_seen_at else None,
        }
        for package in culture.seed_packages.order_by('size_unit', 'size_value')
    ]


def build_public_culture_payload(culture: Culture) -> dict[str, Any]:
    payload = _copy_fields(culture)
    payload['supplier_name'] = culture.supplier.name if culture.supplier else (culture.seed_supplier or '')
    payload['seed_packages'] = _seed_packages_payload_from_culture(culture)
    payload['source_project_culture'] = culture
    payload['source_project'] = culture.project
    payload['published_at'] = timezone.now()
    return payload


def build_project_culture_payload(public_culture: PublicCulture) -> dict[str, Any]:
    payload = _copy_fields(public_culture)
    payload['seed_supplier'] = public_culture.supplier_name or public_culture.seed_supplier or ''
    payload['source_public_culture'] = public_culture
    payload['source_public_version'] = public_culture.version
    payload['origin_type'] = Culture.ORIGIN_IMPORTED
    payload['is_modified_from_source'] = False
    return payload


def detect_public_culture_duplicates(culture: Culture) -> list[DuplicateCandidate]:
    queryset = PublicCulture.objects.filter(
        name_normalized=culture.name_normalized,
        variety_normalized=culture.variety_normalized,
        status=PublicCulture.STATUS_PUBLISHED,
    ).select_related('created_by').order_by('-published_at', '-id')

    candidates: list[DuplicateCandidate] = []
    for item in queryset[:5]:
        created_by_label = ''
        if item.created_by:
            created_by_label = item.created_by.get_full_name().strip() or item.created_by.username or item.created_by.email
        candidates.append(DuplicateCandidate(
            id=item.id,
            name=item.name,
            variety=item.variety,
            version=item.version,
            published_at=item.published_at,
            created_by_label=created_by_label,
        ))
    return candidates


def publish_culture_to_public_library(*, culture: Culture, user: User | None) -> tuple[PublicCulture, list[DuplicateCandidate]]:
    duplicates = detect_public_culture_duplicates(culture)
    public_culture = PublicCulture.objects.create(
        created_by=user,
        status=PublicCulture.STATUS_PUBLISHED,
        version=1,
        **build_public_culture_payload(culture),
    )
    return public_culture, duplicates


def import_public_culture_into_project(*, public_culture: PublicCulture, project: Project) -> Culture:
    culture = Culture.objects.create(
        project=project,
        **build_project_culture_payload(public_culture),
    )
    for package in public_culture.seed_packages or []:
        culture.seed_packages.create(
            project=project,
            size_value=package.get('size_value'),
            size_unit=package.get('size_unit') or 'g',
            evidence_text=package.get('evidence_text') or '',
            last_seen_at=package.get('last_seen_at') or None,
        )
    return culture
