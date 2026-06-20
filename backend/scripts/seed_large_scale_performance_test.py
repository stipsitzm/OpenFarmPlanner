#!/usr/bin/env python
"""Create an idempotent large-scale performance test project."""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

import django

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("AI_ENRICHMENT_ENABLED", "False")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.db import transaction  # noqa: E402

from accounts.models import UserProjectSettings  # noqa: E402
from farm.models import (  # noqa: E402
    Bed,
    BedLayout,
    Culture,
    Field,
    FieldLayout,
    Location,
    PlantingPlan,
    Project,
    ProjectMembership,
    ProjectRevision,
    Supplier,
)
from farm.utils import normalize_text  # noqa: E402
from farm.views import _create_project_revision  # noqa: E402

ACCOUNT_EMAIL = "martin.stipsitz@gmail.com"
PROJECT_NAME = "Large Scale Performance Test"
PROJECT_SLUG = "large-scale-performance-test"

LOCATION_COUNT = 20
FIELDS_PER_LOCATION = 15
BEDS_PER_FIELD = 8
CULTURE_COUNT = 300
SUPPLIER_COUNT = 50
PLANTING_PLAN_COUNT = 5000

LOCATION_ROOTS = [
    "Nordhang",
    "Sonnfeld",
    "Auwiese",
    "Kirschgarten",
    "Mühlacker",
    "Waldkante",
    "Bachterrasse",
    "Hofgarten",
    "Lehmfeld",
    "Windschutz",
    "Obere Au",
    "Unteres Feld",
    "Kräutergarten",
    "Versuchsfläche",
    "Gemeinschaftsacker",
    "Folientunnel",
    "Streuobstwiese",
    "Quellgarten",
    "Weinbergrand",
    "Langzeitbeobachtungsfläche",
]

CROP_NAMES = [
    "Tomate",
    "Paprika",
    "Salat",
    "Karotte",
    "Zwiebel",
    "Knoblauch",
    "Kartoffel",
    "Kürbis",
    "Zucchini",
    "Gurke",
    "Mangold",
    "Spinat",
    "Rote Rübe",
    "Radieschen",
    "Kohlrabi",
    "Brokkoli",
    "Karfiol",
    "Weißkraut",
    "Rotkraut",
    "Wirsing",
    "Fenchel",
    "Sellerie",
    "Petersilie",
    "Basilikum",
    "Dille",
    "Koriander",
    "Buschbohne",
    "Stangenbohne",
    "Erbse",
    "Mais",
]

VARIETY_NAMES = [
    "Robuste Frühsorte",
    "Goldene Auslese",
    "Marktgärtner Spezial",
    "Alpenperle",
    "Donauland",
    "Smaragd",
    "Roter Riese",
    "Weiße Königin",
    "Violette Überraschung",
    "Frühstarter",
]

MARKDOWN_NOTES = [
    "",
    (
        "## Beobachtung\n\n- gleichmäßig wässern\n- Schädlingsdruck prüfen\n\n"
        "**Wichtig:** Mulch nachlegen."
    ),
    "Sonderzeichen-Test: äöü ÄÖÜ ß € µ m² – „Zitat“ & <Tag> / \\.",
    "### Arbeitsablauf\n\n1. Boden lockern\n2. Kompost einarbeiten\n3. Reihen markieren\n\n[Lieferant](https://example.org)",
    "Kurze Notiz.",
    (
        "## Langzeitbeobachtung\n\n"
        "Diese Fläche wird über mehrere Saisonen beobachtet. "
        "Dokumentiert werden Keimrate, Bestandsentwicklung, Wasserbedarf, "
        "Krankheitsdruck, Erntefenster und Nachkultur. "
    )
    * 8,
]


def build_color(index: int) -> str:
    """Return a deterministic, visually varied hexadecimal color."""
    red = (53 + index * 47) % 200 + 30
    green = (91 + index * 67) % 200 + 30
    blue = (137 + index * 83) % 200 + 30
    return f"#{red:02x}{green:02x}{blue:02x}"


def seed() -> Project:  # noqa: C901
    """Replace the named test project with a deterministic large dataset."""
    user_model = get_user_model()
    user = user_model.objects.get(email__iexact=ACCOUNT_EMAIL)

    with transaction.atomic():
        Project.objects.filter(slug=PROJECT_SLUG).delete()
        project = Project.objects.create(
            name=PROJECT_NAME,
            slug=PROJECT_SLUG,
            description=(
                "Realistic large-scale dataset for UI, UX, accessibility, "
                "rendering, and performance evaluation."
            ),
        )
        ProjectMembership.objects.create(
            user=user,
            project=project,
            role=ProjectMembership.ROLE_ADMIN,
        )

        suppliers = [
            Supplier(
                project=project,
                name=(
                    f"Saatgut Lieferant {index:02d} – "
                    f"{'Bio & Partner' if index % 5 else 'Sehr langer Firmenname für '
                    'Überlauftests'}"
                ),
                homepage_url="" if index % 7 == 0 else f"https://supplier-{index:02d}.example.org",
            )
            for index in range(1, SUPPLIER_COUNT + 1)
        ]
        for supplier in suppliers:
            supplier.save()

        locations = []
        for index, root_name in enumerate(LOCATION_ROOTS, start=1):
            locations.append(
                Location(
                    project=project,
                    name=(
                        f"{index:02d} {root_name}"
                        if index != LOCATION_COUNT
                        else f"{index:02d} {root_name} – "
                        + "außergewöhnlich langer Standortname " * 4
                    ),
                    address="" if index % 4 == 0 else f"Feldweg {index}, 80{index:02d} Testdorf",
                    description=(
                        f"Standort {index} mit wechselnden Boden- und " "Expositionsbedingungen."
                    ),
                    soil_type=[
                        Location.SOIL_TYPE_SAND,
                        Location.SOIL_TYPE_LOAM,
                        Location.SOIL_TYPE_CLAY,
                    ][index % 3],
                    exposure=[
                        Location.EXPOSURE_NORTH,
                        Location.EXPOSURE_SOUTH,
                        Location.EXPOSURE_EAST,
                        Location.EXPOSURE_WEST,
                        Location.EXPOSURE_FLAT,
                    ][index % 5],
                    latitude=None if index % 6 == 0 else 47.0 + index / 100,
                    longitude=None if index % 6 == 0 else 15.0 + index / 100,
                    notes=MARKDOWN_NOTES[index % len(MARKDOWN_NOTES)],
                )
            )
        Location.objects.bulk_create(locations)

        fields = []
        for location_index, location in enumerate(locations, start=1):
            for field_index in range(1, FIELDS_PER_LOCATION + 1):
                length = 18.0 + ((location_index * 7 + field_index * 3) % 43)
                width = 8.0 + ((location_index * 5 + field_index * 2) % 17)
                fields.append(
                    Field(
                        project=project,
                        location=location,
                        name=(
                            f"Parzelle {field_index:02d}"
                            if field_index != FIELDS_PER_LOCATION
                            else "Parzelle mit sehr langem Namen – Nordost-Sonderversuch 2026/27"
                        ),
                        area_sqm=Decimal(str(round(length * width, 1))),
                        length_m=None if field_index % 6 == 0 else length,
                        width_m=None if field_index % 6 == 0 else width,
                        notes=MARKDOWN_NOTES[(location_index + field_index) % len(MARKDOWN_NOTES)],
                    )
                )
        Field.objects.bulk_create(fields)

        beds = []
        for field_index, field in enumerate(fields, start=1):
            for bed_index in range(1, BEDS_PER_FIELD + 1):
                length = 6.0 + ((field_index + bed_index * 2) % 19)
                width = [0.75, 0.9, 1.0, 1.2, 1.5][(field_index + bed_index) % 5]
                beds.append(
                    Bed(
                        project=project,
                        field=field,
                        name=(
                            f"Beet {bed_index:02d}"
                            if bed_index != BEDS_PER_FIELD
                            else "Beet 08 – Mischkultur & Langzeitbeobachtung"
                        ),
                        area_sqm=Decimal(str(round(length * width, 1))),
                        length_m=None if bed_index % 7 == 0 else length,
                        width_m=None if bed_index % 7 == 0 else width,
                        notes=MARKDOWN_NOTES[(field_index + bed_index) % len(MARKDOWN_NOTES)],
                    )
                )
        Bed.objects.bulk_create(beds, batch_size=500)

        field_layouts = []
        for index, field in enumerate(fields):
            field_layouts.append(
                FieldLayout(
                    project=project,
                    location=field.location,
                    field=field,
                    x=float((index % FIELDS_PER_LOCATION) * 680),
                    y=float((index % 3) * 290),
                    scale=1.0,
                )
            )
        FieldLayout.objects.bulk_create(field_layouts, batch_size=500)

        bed_layouts = []
        for index, bed in enumerate(beds):
            bed_layouts.append(
                BedLayout(
                    project=project,
                    location=bed.field.location,
                    bed=bed,
                    x=float(20 + (index % BEDS_PER_FIELD) * 68),
                    y=float(72 + ((index // BEDS_PER_FIELD) % 2) * 76),
                    scale=1.0,
                )
            )
        BedLayout.objects.bulk_create(bed_layouts, batch_size=500)

        cultures = []
        for index in range(1, CULTURE_COUNT + 1):
            crop_name = CROP_NAMES[(index - 1) % len(CROP_NAMES)]
            variety = VARIETY_NAMES[(index * 7) % len(VARIETY_NAMES)]
            name = (
                f"{crop_name} {index:03d}"
                if index != CULTURE_COUNT
                else (
                    "Tomate mit einem außergewöhnlich langen Kultur-Namen für "
                    "Tabellen- und Dialogtests"
                )
            )
            cultivation_types = (
                ["direct_sowing", "pre_cultivation"]
                if index % 5 == 0
                else ["direct_sowing"]
                if index % 2 == 0
                else ["pre_cultivation"]
            )
            cultures.append(
                Culture(
                    project=project,
                    name=name,
                    variety=f"{variety} #{index:03d}",
                    name_normalized=normalize_text(name) or "",
                    variety_normalized=normalize_text(f"{variety} #{index:03d}"),
                    notes=MARKDOWN_NOTES[index % len(MARKDOWN_NOTES)],
                    supplier=None if index % 11 == 0 else suppliers[index % len(suppliers)],
                    seed_supplier="" if index % 9 == 0 else suppliers[index % len(suppliers)].name,
                    crop_family=[
                        "Solanaceae",
                        "Brassicaceae",
                        "Apiaceae",
                        "Fabaceae",
                        "Asteraceae",
                    ][index % 5],
                    nutrient_demand=["low", "medium", "high"][index % 3],
                    cultivation_types=cultivation_types,
                    cultivation_type=cultivation_types[0],
                    growth_duration_days=None if index % 17 == 0 else 35 + (index * 13) % 150,
                    harvest_duration_days=None if index % 13 == 0 else 7 + (index * 5) % 45,
                    propagation_duration_days=None if index % 4 == 0 else 14 + (index * 3) % 35,
                    harvest_method=["per_plant", "per_sqm"][index % 2],
                    expected_yield=None
                    if index % 8 == 0
                    else Decimal(str(round(0.5 + (index % 50) / 5, 2))),
                    distance_within_row_m=None
                    if index % 10 == 0
                    else round(0.05 + (index % 10) * 0.04, 2),
                    row_spacing_m=None if index % 12 == 0 else round(0.15 + (index % 8) * 0.08, 2),
                    sowing_depth_m=None
                    if index % 7 == 0
                    else round(0.005 + (index % 6) * 0.005, 3),
                    display_color=build_color(index),
                )
            )
        Culture.objects.bulk_create(cultures, batch_size=300)

        base_date = date(2024, 1, 1)
        planting_plans = []
        for index in range(PLANTING_PLAN_COUNT):
            culture = cultures[(index * 17) % len(cultures)]
            bed = beds[(index * 37) % len(beds)]
            planting_date = base_date + timedelta(days=(index * 11) % 1460)
            growth_days = culture.growth_duration_days or 60
            harvest_days = culture.harvest_duration_days or 14
            planting_plans.append(
                PlantingPlan(
                    project=project,
                    culture=culture,
                    bed=bed,
                    cultivation_type=culture.cultivation_types[
                        index % len(culture.cultivation_types)
                    ],
                    planting_date=planting_date,
                    harvest_date=planting_date + timedelta(days=growth_days),
                    harvest_end_date=planting_date + timedelta(days=growth_days + harvest_days),
                    quantity=None if index % 9 == 0 else 10 + (index * 23) % 490,
                    area_usage_sqm=(
                        None
                        if index % 14 == 0
                        else Decimal(str(round(0.5 + (index % 100) / 10, 2)))
                    ),
                    notes=MARKDOWN_NOTES[index % len(MARKDOWN_NOTES)],
                    created_by=user,
                    updated_by=user,
                )
            )
        PlantingPlan.objects.bulk_create(planting_plans, batch_size=500)

        settings, _ = UserProjectSettings.objects.get_or_create(user=user)
        settings.default_project = project
        settings.last_project = project
        settings.save(update_fields=["default_project", "last_project", "updated_at"])

        ProjectRevision.objects.filter(project=project).delete()
        _create_project_revision("Large-scale dataset generated", project=project)

    return project


if __name__ == "__main__":
    seeded_project = seed()
    print(
        f"Created project {seeded_project.id}: {seeded_project.name} "
        f"({LOCATION_COUNT} locations, {LOCATION_COUNT * FIELDS_PER_LOCATION} parcels, "
        f"{LOCATION_COUNT * FIELDS_PER_LOCATION * BEDS_PER_FIELD} beds, "
        f"{CULTURE_COUNT} cultures, {SUPPLIER_COUNT} suppliers, "
        f"{PLANTING_PLAN_COUNT} planting plans)."
    )
