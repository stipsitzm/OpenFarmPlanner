from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify

from accounts.models import UserProjectSettings

from farm.models import (
    Bed,
    BedLayout,
    Culture,
    Field,
    FieldLayout,
    Location,
    PlantingPlan,
    Project,
    ProjectMembership,
    SeedPackage,
    Task,
)

DEMO_TEMPLATE_SLUG = 'demo-garten-vorlage'
DEMO_TEMPLATE_NAME = 'Demo-Garten (Vorlage)'
DEMO_COPY_NAME = 'Demo-Garten'


@dataclass
class DemoOpenResult:
    template_project: Project
    demo_project: Project


def _grant_template_access_to_superusers(template_project: Project) -> None:
    user_model = get_user_model()
    for superuser in user_model.objects.filter(is_superuser=True, is_active=True):
        ProjectMembership.objects.get_or_create(
            user=superuser,
            project=template_project,
            defaults={'role': ProjectMembership.ROLE_ADMIN},
        )


def _seed_demo_template(template_project: Project) -> None:
    location = Location.objects.create(
        project=template_project,
        name='Hauptstandort',
        address='Gartenweg 12, 3500 Krems an der Donau',
        notes='Gemüsebau mit Wochenkisten und Marktstand.',
    )

    feld_nord = Field.objects.create(
        project=template_project,
        location=location,
        name='Feld Nord',
        length_m=30.0,
        width_m=12.0,
        notes='Frühjahrsschwerpunkt Blattgemüse.',
    )
    feld_sued = Field.objects.create(
        project=template_project,
        location=location,
        name='Feld Süd',
        length_m=24.0,
        width_m=10.0,
        notes='Sommerkulturen mit höherem Wärmebedarf.',
    )

    beds: dict[str, Bed] = {}
    for field, bed_names in (
        (feld_nord, ['Beet 1', 'Beet 2', 'Beet 3', 'Beet 4']),
        (feld_sued, ['Beet 5', 'Beet 6']),
    ):
        for index, bed_name in enumerate(bed_names, start=1):
            beds[bed_name] = Bed.objects.create(
                project=template_project,
                field=field,
                name=bed_name,
                length_m=10.0,
                width_m=1.2,
                notes='Standardbeet 1,2 m breit.' if index == 1 else '',
            )

    for index, field in enumerate([feld_nord, feld_sued]):
        FieldLayout.objects.create(
            project=template_project,
            location=location,
            field=field,
            x=10.0 + (index * 40.0),
            y=12.0,
            scale=1.0,
        )

    for index, bed in enumerate(beds.values()):
        BedLayout.objects.create(
            project=template_project,
            location=location,
            bed=bed,
            x=12.0 + ((index % 3) * 18.0),
            y=26.0 + ((index // 3) * 14.0),
            scale=1.0,
        )

    cultures = {
        'Salat': Culture.objects.create(
            project=template_project,
            name='Salat',
            variety='Batavia grün',
            cultivation_types=['pre_cultivation'],
            growth_duration_days=35,
            harvest_duration_days=14,
            harvest_method='per_sqm',
            expected_yield=3.5,
            notes='Schnittweise Ernte möglich.',
        ),
        'Karotte': Culture.objects.create(
            project=template_project,
            name='Karotte',
            variety='Nantaise',
            cultivation_types=['direct_sowing'],
            growth_duration_days=95,
            harvest_duration_days=20,
            harvest_method='per_sqm',
            expected_yield=4.2,
        ),
        'Zucchini': Culture.objects.create(
            project=template_project,
            name='Zucchini',
            variety='Zuboda',
            cultivation_types=['pre_cultivation'],
            growth_duration_days=65,
            harvest_duration_days=35,
            harvest_method='per_plant',
            expected_yield=1.8,
        ),
        'Radieschen': Culture.objects.create(
            project=template_project,
            name='Radieschen',
            variety='Sora',
            cultivation_types=['direct_sowing'],
            growth_duration_days=28,
            harvest_duration_days=7,
            harvest_method='per_sqm',
            expected_yield=1.6,
        ),
        'Mangold': Culture.objects.create(
            project=template_project,
            name='Mangold',
            variety='Bright Lights',
            cultivation_types=['pre_cultivation'],
            growth_duration_days=55,
            harvest_duration_days=75,
            harvest_method='per_sqm',
            expected_yield=4.0,
        ),
        'Kohlrabi': Culture.objects.create(
            project=template_project,
            name='Kohlrabi',
            variety='Superschmelz',
            cultivation_types=['pre_cultivation'],
            growth_duration_days=60,
            harvest_duration_days=14,
            harvest_method='per_plant',
            expected_yield=0.45,
        ),
    }

    SeedPackage.objects.create(project=template_project, culture=cultures['Salat'], size_value=5, size_unit=SeedPackage.UNIT_GRAMS)
    SeedPackage.objects.create(project=template_project, culture=cultures['Karotte'], size_value=10, size_unit=SeedPackage.UNIT_GRAMS)
    SeedPackage.objects.create(project=template_project, culture=cultures['Kohlrabi'], size_value=100, size_unit=SeedPackage.UNIT_SEEDS)

    plans = [
        PlantingPlan.objects.create(
            project=template_project,
            culture=cultures['Salat'],
            bed=beds['Beet 1'],
            cultivation_type='pre_cultivation',
            planting_date=date(2026, 3, 18),
            quantity=140,
            area_usage_sqm=8.0,
            notes='Satz 1 für April-Ernte.',
        ),
        PlantingPlan.objects.create(
            project=template_project,
            culture=cultures['Radieschen'],
            bed=beds['Beet 2'],
            cultivation_type='direct_sowing',
            planting_date=date(2026, 3, 20),
            quantity=900,
            area_usage_sqm=6.5,
            notes='Schnelle Frühjahrsfolge.',
        ),
        PlantingPlan.objects.create(
            project=template_project,
            culture=cultures['Karotte'],
            bed=beds['Beet 3'],
            cultivation_type='direct_sowing',
            planting_date=date(2026, 4, 2),
            quantity=1400,
            area_usage_sqm=11.5,
        ),
        PlantingPlan.objects.create(
            project=template_project,
            culture=cultures['Mangold'],
            bed=beds['Beet 4'],
            cultivation_type='pre_cultivation',
            planting_date=date(2026, 4, 10),
            quantity=120,
            area_usage_sqm=9.0,
        ),
        PlantingPlan.objects.create(
            project=template_project,
            culture=cultures['Kohlrabi'],
            bed=beds['Beet 5'],
            cultivation_type='pre_cultivation',
            planting_date=date(2026, 4, 6),
            quantity=180,
            area_usage_sqm=7.0,
        ),
        PlantingPlan.objects.create(
            project=template_project,
            culture=cultures['Zucchini'],
            bed=beds['Beet 6'],
            cultivation_type='pre_cultivation',
            planting_date=date(2026, 5, 5),
            quantity=24,
            area_usage_sqm=10.0,
        ),
    ]

    Task.objects.create(project=template_project, planting_plan=plans[0], title='Aussaat Salat nachziehen', due_date=date(2026, 3, 25), status='pending')
    Task.objects.create(project=template_project, planting_plan=plans[2], title='Karottenbeet hacken', due_date=date(2026, 4, 18), status='pending')
    Task.objects.create(project=template_project, planting_plan=plans[5], title='Bewässerung prüfen', due_date=date(2026, 5, 7), status='pending')
    Task.objects.create(project=template_project, title='Erntekisten für Markt vorbereiten', due_date=date(2026, 4, 22), status='in_progress')


def ensure_demo_template_project() -> Project:
    template_project, created = Project.objects.get_or_create(
        slug=DEMO_TEMPLATE_SLUG,
        defaults={
            'name': DEMO_TEMPLATE_NAME,
            'description': 'Bearbeitbare Vorlage für Demo-Projekte.',
            'is_demo_template': True,
            'is_demo_copy': False,
            'is_active': True,
        },
    )
    if not template_project.is_demo_template:
        template_project.is_demo_template = True
        template_project.is_demo_copy = False
        template_project.save(update_fields=['is_demo_template', 'is_demo_copy', 'updated_at'])

    if created and not template_project.locations.exists():
        _seed_demo_template(template_project)

    _grant_template_access_to_superusers(template_project)
    return template_project


def _clone_project_entities(source_project: Project, target_project: Project) -> None:
    location_map: dict[int, Location] = {}
    field_map: dict[int, Field] = {}
    bed_map: dict[int, Bed] = {}
    culture_map: dict[int, Culture] = {}
    plan_map: dict[int, PlantingPlan] = {}

    for source_location in Location.objects.filter(project=source_project):
        location_map[source_location.id] = Location.objects.create(
            project=target_project,
            name=source_location.name,
            address=source_location.address,
            notes=source_location.notes,
        )

    for source_field in Field.objects.filter(project=source_project):
        field_map[source_field.id] = Field.objects.create(
            project=target_project,
            name=source_field.name,
            location=location_map[source_field.location_id],
            area_sqm=source_field.area_sqm,
            length_m=source_field.length_m,
            width_m=source_field.width_m,
            notes=source_field.notes,
        )

    for source_bed in Bed.objects.filter(project=source_project):
        bed_map[source_bed.id] = Bed.objects.create(
            project=target_project,
            name=source_bed.name,
            field=field_map[source_bed.field_id],
            area_sqm=source_bed.area_sqm,
            length_m=source_bed.length_m,
            width_m=source_bed.width_m,
            notes=source_bed.notes,
        )

    for source_field_layout in FieldLayout.objects.filter(project=source_project):
        FieldLayout.objects.create(
            project=target_project,
            field=field_map[source_field_layout.field_id],
            location=location_map[source_field_layout.location_id],
            x=source_field_layout.x,
            y=source_field_layout.y,
            version=source_field_layout.version,
            scale=source_field_layout.scale,
        )

    for source_bed_layout in BedLayout.objects.filter(project=source_project):
        BedLayout.objects.create(
            project=target_project,
            bed=bed_map[source_bed_layout.bed_id],
            location=location_map[source_bed_layout.location_id],
            x=source_bed_layout.x,
            y=source_bed_layout.y,
            version=source_bed_layout.version,
            scale=source_bed_layout.scale,
        )

    for source_culture in Culture.objects.filter(project=source_project):
        cloned_culture = Culture.objects.create(
            project=target_project,
            name=source_culture.name,
            variety=source_culture.variety,
            notes=source_culture.notes,
            seed_supplier=source_culture.seed_supplier,
            supplier=None,
            supplier_product_url='',
            image_file=source_culture.image_file,
            source_public_culture=source_culture.source_public_culture,
            source_public_version=source_culture.source_public_version,
            origin_type=source_culture.origin_type,
            is_modified_from_source=source_culture.is_modified_from_source,
            crop_family=source_culture.crop_family,
            nutrient_demand=source_culture.nutrient_demand,
            cultivation_types=source_culture.cultivation_types,
            cultivation_type=source_culture.cultivation_type,
            growth_duration_days=source_culture.growth_duration_days,
            harvest_duration_days=source_culture.harvest_duration_days,
            propagation_duration_days=source_culture.propagation_duration_days,
            harvest_method=source_culture.harvest_method,
            expected_yield=source_culture.expected_yield,
            allow_deviation_delivery_weeks=source_culture.allow_deviation_delivery_weeks,
            distance_within_row_m=source_culture.distance_within_row_m,
            row_spacing_m=source_culture.row_spacing_m,
            sowing_depth_m=source_culture.sowing_depth_m,
            seed_rate_value=source_culture.seed_rate_value,
            seed_rate_unit=source_culture.seed_rate_unit,
            seed_rate_by_cultivation=source_culture.seed_rate_by_cultivation,
            sowing_calculation_safety_percent=source_culture.sowing_calculation_safety_percent,
            seed_rate_direct_value=source_culture.seed_rate_direct_value,
            seed_rate_direct_unit=source_culture.seed_rate_direct_unit,
            sowing_calculation_safety_percent_direct=source_culture.sowing_calculation_safety_percent_direct,
            seed_rate_pre_cultivation_value=source_culture.seed_rate_pre_cultivation_value,
            seed_rate_pre_cultivation_unit=source_culture.seed_rate_pre_cultivation_unit,
            sowing_calculation_safety_percent_pre_cultivation=source_culture.sowing_calculation_safety_percent_pre_cultivation,
            thousand_kernel_weight_g=source_culture.thousand_kernel_weight_g,
            seeding_requirement=source_culture.seeding_requirement,
            seeding_requirement_type=source_culture.seeding_requirement_type,
            display_color=source_culture.display_color,
        )
        culture_map[source_culture.id] = cloned_culture

    for source_package in SeedPackage.objects.filter(project=source_project):
        SeedPackage.objects.create(
            project=target_project,
            culture=culture_map[source_package.culture_id],
            size_value=source_package.size_value,
            size_unit=source_package.size_unit,
            evidence_text=source_package.evidence_text,
            last_seen_at=source_package.last_seen_at,
        )

    for source_plan in PlantingPlan.objects.filter(project=source_project):
        plan_map[source_plan.id] = PlantingPlan.objects.create(
            project=target_project,
            culture=culture_map[source_plan.culture_id],
            bed=bed_map[source_plan.bed_id],
            cultivation_type=source_plan.cultivation_type,
            planting_date=source_plan.planting_date,
            harvest_date=source_plan.harvest_date,
            harvest_end_date=source_plan.harvest_end_date,
            quantity=source_plan.quantity,
            area_usage_sqm=source_plan.area_usage_sqm,
            notes=source_plan.notes,
        )

    for source_task in Task.objects.filter(project=source_project):
        Task.objects.create(
            project=target_project,
            title=source_task.title,
            description=source_task.description,
            planting_plan=plan_map.get(source_task.planting_plan_id),
            due_date=source_task.due_date,
            status=source_task.status,
        )


def _build_demo_copy_slug(user_id: int) -> str:
    return slugify(f'demo-{user_id}') or f'demo-{user_id}'


@transaction.atomic
def open_fresh_demo_project_for_user(user) -> DemoOpenResult:
    template_project = ensure_demo_template_project()

    Project.objects.filter(is_demo_copy=True, demo_owner=user).delete()

    demo_project = Project.objects.create(
        name=DEMO_COPY_NAME,
        slug=_build_demo_copy_slug(user.id),
        description='Zurücksetzbares Demo-Projekt auf Basis der Demo-Vorlage.',
        is_active=True,
        is_demo_template=False,
        is_demo_copy=True,
        demo_owner=user,
    )

    _clone_project_entities(template_project, demo_project)

    ProjectMembership.objects.update_or_create(
        user=user,
        project=demo_project,
        defaults={'role': ProjectMembership.ROLE_ADMIN},
    )

    settings_obj, _ = UserProjectSettings.objects.get_or_create(user=user)
    settings_obj.default_project = demo_project
    settings_obj.last_project = demo_project
    settings_obj.save(update_fields=['default_project', 'last_project', 'updated_at'])

    return DemoOpenResult(template_project=template_project, demo_project=demo_project)
