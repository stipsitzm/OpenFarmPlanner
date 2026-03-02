from datetime import date

import pytest
from rest_framework.test import APIClient

from farm.models import Location, Field, Bed, Culture, PlantingPlan, SeedPackage


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def bed():
    location = Location.objects.create(name='Loc')
    field = Field.objects.create(name='Field', location=location)
    return Bed.objects.create(name='Bed', field=field, area_sqm=100)


def _create_plan(culture: Culture, bed: Bed, area: float, quantity: int | None = None):
    return PlantingPlan.objects.create(
        culture=culture,
        bed=bed,
        planting_date=date(2025, 3, 1),
        area_usage_sqm=area,
        quantity=quantity,
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
    )
    _create_plan(culture, bed, 5)
    _create_plan(culture, bed, 5)
    SeedPackage.objects.create(culture=culture, size_value=25, size_unit='g')

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
    )
    _create_plan(culture, bed, 10)
    SeedPackage.objects.create(culture=culture, size_value=25, size_unit='g')

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
    )
    _create_plan(culture, bed, 10)
    SeedPackage.objects.create(culture=culture, size_value=25, size_unit='g')

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = next(item for item in response.json()['results'] if item['culture_name'] == 'Radish')
    assert row['total_grams'] is None
    assert row['packages_needed'] is None
    assert row['warning'] == 'Missing thousand-kernel weight for conversion to grams.'
