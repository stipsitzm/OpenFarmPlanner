from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from farm.models import Location, Field, Bed, Culture, PlantingPlan, Project, ProjectMembership, SeedPackage

User = get_user_model()


@pytest.fixture
def project_context(db):
    """Create a user, project, and membership for project-scoped API tests."""
    user = User.objects.create_user(username='sduser', email='sd@example.com', password='testpass', is_active=True)
    project = Project.objects.create(name='Seed Demand Project', slug='seed-demand-project')
    ProjectMembership.objects.create(user=user, project=project, role='admin')
    return user, project


@pytest.fixture
def api_client(project_context):
    user, project = project_context
    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_PROJECT_ID'] = str(project.id)
    return client


@pytest.fixture
def bed(project_context):
    _, project = project_context
    location = Location.objects.create(name='Loc', project=project)
    field = Field.objects.create(name='Field', location=location, project=project)
    return Bed.objects.create(name='Bed', field=field, area_sqm=100, project=project)


def _create_plan(culture: Culture, bed: Bed, area: float, quantity: int | None = None):
    return PlantingPlan.objects.create(
        culture=culture,
        bed=bed,
        planting_date=date(2025, 3, 1),
        area_usage_sqm=area,
        quantity=quantity,
        project=bed.project,
    )


@pytest.mark.django_db
def test_seed_demand_applies_safety_margin(api_client: APIClient, bed: Bed):
    culture = Culture.objects.create(
        name='Carrot',
        growth_duration_days=90,
        harvest_duration_days=14,
        seed_rate_value=10,
        seed_rate_unit='g_per_m2',
        sowing_calculation_safety_percent=10,
        project=bed.project,
    )
    _create_plan(culture, bed, 5)
    _create_plan(culture, bed, 5)
    SeedPackage.objects.create(culture=culture, size_value=25, size_unit='g', project=bed.project)

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = response.json()['results'][0]
    assert row['culture_name'] == 'Carrot'
    assert row['total_grams'] == pytest.approx(110.0)
    assert row['package_suggestion']['pack_count'] == 5
    assert row['warning'] is None


@pytest.mark.django_db
def test_seed_demand_rounds_packages_up(api_client: APIClient, bed: Bed):
    culture = Culture.objects.create(
        name='Cabbage',
        growth_duration_days=90,
        harvest_duration_days=14,
        seed_rate_value=18.42,
        seed_rate_unit='g_per_m2',
        project=bed.project,
    )
    _create_plan(culture, bed, 10)
    SeedPackage.objects.create(culture=culture, size_value=25, size_unit='g', project=bed.project)

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = next(item for item in response.json()['results'] if item['culture_name'] == 'Cabbage')
    assert row['total_grams'] == pytest.approx(184.2)
    assert row['package_suggestion']['pack_count'] == 8


@pytest.mark.django_db
def test_seed_rate_unit_legacy_value_is_normalized(api_client: APIClient):
    payload = {
        'name': 'Bean',
        'variety': 'Runner',
        'growth_duration_days': 70,
        'harvest_duration_days': 10,
        'harvest_method': 'per_plant',
        'seed_rate_value': 2,
        'seed_rate_unit': 'pcs_per_plant',
        'supplier_name': 'Test Supplier',
    }

    response = api_client.post('/openfarmplanner/api/cultures/', payload, format='json')
    assert response.status_code == 201
    assert response.json()['seed_rate_unit'] == 'seeds_per_plant'

    culture = Culture.objects.get(id=response.json()['id'])
    assert culture.seed_rate_unit == 'seeds_per_plant'


@pytest.mark.django_db
def test_seed_rate_unit_text_variant_is_normalized_to_g_per_m2(api_client: APIClient):
    payload = {
        'name': 'Spinach',
        'variety': 'Matador',
        'growth_duration_days': 55,
        'harvest_duration_days': 10,
        'harvest_method': 'per_sqm',
        'seed_rate_value': 2,
        'seed_rate_unit': 'Gramm pro 100 Quadratmeter',
        'supplier_name': 'Test Supplier',
    }

    response = api_client.post('/openfarmplanner/api/cultures/', payload, format='json')
    assert response.status_code == 201
    assert response.json()['seed_rate_unit'] == 'g_per_m2'


@pytest.mark.django_db
def test_seed_demand_returns_warning_when_gram_conversion_missing(api_client: APIClient, bed: Bed):
    culture = Culture.objects.create(
        name='Radish',
        growth_duration_days=35,
        harvest_duration_days=10,
        seed_rate_value=50,
        seed_rate_unit='seeds/m',
        row_spacing_m=0.3,
        project=bed.project,
    )
    _create_plan(culture, bed, 10)
    SeedPackage.objects.create(culture=culture, size_value=25, size_unit='g', project=bed.project)

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = next(item for item in response.json()['results'] if item['culture_name'] == 'Radish')
    assert row['total_grams'] is None
    assert row['packages_needed'] is None
    assert row['warning'] == 'Missing thousand-kernel weight for conversion to grams.'


@pytest.mark.django_db
def test_seed_demand_is_limited_to_active_project(api_client: APIClient, bed: Bed, project_context):
    _, active_project = project_context
    other_project = Project.objects.create(name='Other Project', slug='other-project')

    active_culture = Culture.objects.create(
        name='Lettuce',
        growth_duration_days=45,
        harvest_duration_days=10,
        seed_rate_value=4,
        seed_rate_unit='g_per_m2',
        project=active_project,
    )
    _create_plan(active_culture, bed, 3)
    SeedPackage.objects.create(culture=active_culture, size_value=10, size_unit='g', project=active_project)

    other_location = Location.objects.create(name='Other Loc', project=other_project)
    other_field = Field.objects.create(name='Other Field', location=other_location, project=other_project)
    other_bed = Bed.objects.create(name='Other Bed', field=other_field, area_sqm=50, project=other_project)
    other_culture = Culture.objects.create(
        name='Bean',
        variety='Hidden',
        growth_duration_days=60,
        harvest_duration_days=14,
        seed_rate_value=7,
        seed_rate_unit='g_per_m2',
        project=other_project,
    )
    PlantingPlan.objects.create(
        culture=other_culture,
        bed=other_bed,
        planting_date=date(2025, 4, 1),
        area_usage_sqm=5,
        project=other_project,
    )
    SeedPackage.objects.create(culture=other_culture, size_value=25, size_unit='g', project=other_project)

    response = api_client.get('/openfarmplanner/api/seed-demand/')

    assert response.status_code == 200
    rows = response.json()['results']
    assert [row['culture_name'] for row in rows] == ['Lettuce']


@pytest.mark.django_db
def test_seed_demand_uses_legacy_seed_packages_without_project(api_client: APIClient, bed: Bed):
    culture = Culture.objects.create(
        name='Bean',
        variety='Legacy',
        growth_duration_days=70,
        harvest_duration_days=14,
        seed_rate_value=5,
        seed_rate_unit='g_per_m2',
        project=bed.project,
    )
    _create_plan(culture, bed, 5)
    SeedPackage.objects.create(culture=culture, size_value=25, size_unit='g', project=None)

    response = api_client.get('/openfarmplanner/api/seed-demand/')

    assert response.status_code == 200
    row = next(item for item in response.json()['results'] if item['culture_name'] == 'Bean')
    assert row['seed_packages'] == [{'size_value': 25.0, 'size_unit': 'g'}]
    assert row['package_suggestion']['pack_count'] == 1
