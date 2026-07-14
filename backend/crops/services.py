"""
Crop Library service layer — the single place `crops.views` (and, in the
future, any other consumer) reads published crop data from.

This module must never import anything project-scoped (`Project`,
`PlantingPlan`, `Bed`, ...) or anything from farm's domain view/serializer packages
— see docs/crop-library-architecture.md for the dependency rule this
enforces ("the crop library knows nothing about projects; farm planning
uses the crop library, never the other way round").

Publishing a project's `Culture` into the library, and importing a
published crop back into a project, are intentionally NOT in this module:
those are bridge operations that need `Culture`/`Project`, and stay in
`farm.services.public_cultures` until a future step decides how that
bridge should work once the crop library is a genuinely separate service
(e.g. an HTTP call instead of a direct ORM write). See the architecture
doc's "deliberately deferred" section.
"""
from __future__ import annotations

from django.db.models import Q, QuerySet

from farm.models import PublicCulture
from farm.utils import normalize_text


def list_published_crops(*, query: str = '', name: str = '', variety: str = '') -> QuerySet[PublicCulture]:
    """Published crops, optionally filtered by a free-text query and/or exact-field substrings."""
    queryset = PublicCulture.objects.filter(status=PublicCulture.STATUS_PUBLISHED).order_by('name', 'variety')

    query = query.strip()
    name = name.strip()
    variety = variety.strip()

    if query:
        queryset = queryset.filter(Q(name__icontains=query) | Q(variety__icontains=query))
    if name:
        queryset = queryset.filter(name__icontains=name)
    if variety:
        queryset = queryset.filter(variety__icontains=variety)
    return queryset


def get_published_crop(pk: int) -> PublicCulture:
    """A single published crop by id. Raises `PublicCulture.DoesNotExist` if not found or unpublished."""
    return PublicCulture.objects.get(pk=pk, status=PublicCulture.STATUS_PUBLISHED)


def find_exact_crop_match(*, name: str | None, variety: str | None) -> PublicCulture | None:
    """The most recently published crop whose normalized name+variety match exactly, if any."""
    normalized_name = normalize_text(name)
    normalized_variety = normalize_text(variety)
    if not normalized_name or not normalized_variety:
        return None

    return PublicCulture.objects.filter(
        status=PublicCulture.STATUS_PUBLISHED,
        name_normalized=normalized_name,
        variety_normalized=normalized_variety,
    ).only('id', 'name', 'variety', 'published_at').order_by('-published_at', '-id').first()
