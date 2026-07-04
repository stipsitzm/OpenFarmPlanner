from __future__ import annotations

# The public culture library (PublicCulture + this module) is a candidate for
# extraction into a separate service consumed by OFP over an API (under
# discussion as of 2026-07). Keep this module's dependency on `farm.models`
# limited to Culture/Project/PublicCulture, and avoid pulling in
# project-history/EntityRevision or other farm-app-internal concerns here.

from dataclasses import dataclass
import re
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


class DuplicatePublicCultureError(Exception):
    """Raised when attempting to publish a culture that already exists publicly."""

    def __init__(self, *, duplicates: list[DuplicateCandidate], normalized_identity: dict[str, str]) -> None:
        super().__init__('A similar public culture already exists.')
        self.duplicates = duplicates
        self.normalized_identity = normalized_identity


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


def normalize_identity_value(value: str | None) -> str:
    """Normalize values used for duplicate identity comparisons."""
    compacted = re.sub(r'\s+', ' ', (value or '').strip())
    return compacted.lower()


def get_culture_supplier_label(culture: Culture) -> str:
    if culture.supplier:
        return culture.supplier.name or ''
    return culture.seed_supplier or ''


def get_public_supplier_label(public_culture: PublicCulture) -> str:
    return public_culture.supplier_name or public_culture.seed_supplier or ''


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
    normalized_supplier = normalize_identity_value(get_culture_supplier_label(culture))
    queryset = PublicCulture.objects.filter(
        name_normalized=culture.name_normalized,
        variety_normalized=culture.variety_normalized,
        status=PublicCulture.STATUS_PUBLISHED,
    ).select_related('created_by').order_by('-published_at', '-id')

    candidates: list[DuplicateCandidate] = []
    for item in queryset:
        if normalize_identity_value(get_public_supplier_label(item)) != normalized_supplier:
            continue
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
        if len(candidates) >= 5:
            break
    return candidates


def find_owned_public_culture_for_update(*, culture: Culture, user: User | None) -> PublicCulture | None:
    """Return the public culture that this user is allowed to update for the given culture."""
    if user is None:
        return None

    if culture.source_public_culture_id:
        source_public = PublicCulture.objects.filter(
            id=culture.source_public_culture_id,
            status=PublicCulture.STATUS_PUBLISHED,
        ).first()
        if source_public and source_public.created_by_id == user.id:
            return source_public
        if source_public and source_public.created_by_id != user.id:
            return None

    return PublicCulture.objects.filter(
        source_project_culture=culture,
        created_by=user,
        status=PublicCulture.STATUS_PUBLISHED,
    ).order_by('-updated_at', '-id').first()


def _update_public_culture_from_project_culture(*, public_culture: PublicCulture, culture: Culture) -> PublicCulture:
    payload = build_public_culture_payload(culture)
    payload.pop('published_at', None)
    for field, value in payload.items():
        setattr(public_culture, field, value)
    public_culture.version = max(public_culture.version, 1) + 1
    public_culture.save()
    return public_culture


def publish_culture_to_public_library(*, culture: Culture, user: User | None) -> tuple[PublicCulture, list[DuplicateCandidate], str]:
    update_target = find_owned_public_culture_for_update(culture=culture, user=user)
    duplicates = detect_public_culture_duplicates(culture)
    if update_target:
        updated_public_culture = _update_public_culture_from_project_culture(public_culture=update_target, culture=culture)
        non_target_duplicates = [item for item in duplicates if item.id != update_target.id]
        return updated_public_culture, non_target_duplicates, 'updated'

    if duplicates:
        raise DuplicatePublicCultureError(
            duplicates=duplicates,
            normalized_identity={
                'name': culture.name_normalized,
                'variety': culture.variety_normalized,
                'seed_supplier': normalize_identity_value(get_culture_supplier_label(culture)),
            },
        )
    public_culture = PublicCulture.objects.create(
        created_by=user,
        status=PublicCulture.STATUS_PUBLISHED,
        version=1,
        **build_public_culture_payload(culture),
    )
    return public_culture, duplicates, 'created'


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
