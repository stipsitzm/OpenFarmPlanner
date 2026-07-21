from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from farm.models import Bed, Culture, Field, Location, PlantingPlan, Project, ProjectMembership

User = get_user_model()


@pytest.mark.django_db
def test_planting_plan_list_includes_culture_propagation_metadata():
    user = User.objects.create_user(
        username='calendar-user',
        email='calendar@example.com',
        password='testpass',
        is_active=True,
    )
    project = Project.objects.create(name='Calendar Project', slug='calendar-project')
    ProjectMembership.objects.create(user=user, project=project, role='admin')

    location = Location.objects.create(name='Hof', project=project)
    field = Field.objects.create(name='Nordfeld', location=location, project=project)
    bed = Bed.objects.create(name='Beet A', field=field, project=project)
    culture = Culture.objects.create(
        name='Salat',
        variety='Bijella',
        propagation_duration_days=25,
        cultivation_type='pre_cultivation',
        cultivation_types=['pre_cultivation', 'direct_sowing'],
        display_color='#00aa44',
        growth_duration_days=50,
        harvest_duration_days=7,
        project=project,
    )
    PlantingPlan.objects.create(
        culture=culture,
        bed=bed,
        planting_date=date(2026, 5, 10),
        project=project,
    )

    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_PROJECT_ID'] = str(project.id)

    response = client.get('/openfarmplanner/api/planting-plans/')

    assert response.status_code == 200
    row = response.json()['results'][0]
    assert row['culture_name'] == 'Salat'
    assert row['culture_variety'] == 'Bijella'
    assert row['culture_display_color'] == '#00aa44'
    assert row['culture_propagation_duration_days'] == 25
    assert row['culture_cultivation_type'] == 'pre_cultivation'
    assert row['culture_cultivation_types'] == ['pre_cultivation', 'direct_sowing']


@pytest.mark.django_db
def test_planting_plan_can_be_saved_as_draft_with_only_culture():
    """A planting plan can be created with just a culture selected — the user
    should be able to leave bed/planting_date/cultivation_type for later
    without losing what they've already entered. Downstream endpoints
    (calendar, seed demand, yield calendar) must tolerate such a record."""
    user = User.objects.create_user(
        username='draft-user',
        email='draft@example.com',
        password='testpass',
        is_active=True,
    )
    project = Project.objects.create(name='Draft Project', slug='draft-project')
    ProjectMembership.objects.create(user=user, project=project, role='admin')

    culture = Culture.objects.create(
        name='Mais',
        variety='Rot',
        propagation_duration_days=21,
        cultivation_type='direct_sowing',
        cultivation_types=['direct_sowing'],
        project=project,
    )

    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_PROJECT_ID'] = str(project.id)

    create_response = client.post(
        '/openfarmplanner/api/planting-plans/',
        data={'culture': culture.id},
    )
    assert create_response.status_code == 201, create_response.content
    body = create_response.json()
    assert body['bed'] is None
    assert body['bed_name'] is None
    assert body['planting_date'] is None
    assert body['cultivation_type'] == ''

    plan = PlantingPlan.objects.get(pk=body['id'])
    assert plan.cultivation_type == ''
    assert str(plan) == 'Mais in – - –'

    seed_demand_response = client.get('/openfarmplanner/api/seed-demand/')
    assert seed_demand_response.status_code == 200

    yield_calendar_response = client.get('/openfarmplanner/api/yield-calendar/')
    assert yield_calendar_response.status_code == 200

    list_response = client.get('/openfarmplanner/api/planting-plans/')
    assert list_response.status_code == 200
    assert list_response.json()['results'][0]['id'] == plan.id


@pytest.mark.django_db
def test_planting_plan_can_be_saved_as_draft_with_only_bed():
    """The reverse of the culture-only draft: a bed can be chosen before a
    culture, and the record must still serialize/str() without crashing on
    the now-absent culture."""
    user = User.objects.create_user(
        username='draft-bed-user',
        email='draft-bed@example.com',
        password='testpass',
        is_active=True,
    )
    project = Project.objects.create(name='Draft Bed Project', slug='draft-bed-project')
    ProjectMembership.objects.create(user=user, project=project, role='admin')

    location = Location.objects.create(name='Hof', project=project)
    field = Field.objects.create(name='Nordfeld', location=location, project=project)
    bed = Bed.objects.create(name='Beet A', field=field, project=project)

    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_PROJECT_ID'] = str(project.id)

    create_response = client.post(
        '/openfarmplanner/api/planting-plans/',
        data={'bed': bed.id},
    )
    assert create_response.status_code == 201, create_response.content
    body = create_response.json()
    assert body['culture'] is None
    assert body['culture_name'] is None
    assert body['bed'] == bed.id

    plan = PlantingPlan.objects.get(pk=body['id'])
    assert str(plan) == '– in Beet A - –'

    seed_demand_response = client.get('/openfarmplanner/api/seed-demand/')
    assert seed_demand_response.status_code == 200

    yield_calendar_response = client.get('/openfarmplanner/api/yield-calendar/')
    assert yield_calendar_response.status_code == 200


@pytest.mark.django_db
def test_planting_plan_without_culture_or_bed_is_rejected():
    """The backend keeps a minimal integrity floor even though the frontend
    also blocks this: at least one of culture/bed is required."""
    user = User.objects.create_user(
        username='draft-empty-user',
        email='draft-empty@example.com',
        password='testpass',
        is_active=True,
    )
    project = Project.objects.create(name='Draft Empty Project', slug='draft-empty-project')
    ProjectMembership.objects.create(user=user, project=project, role='admin')

    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_PROJECT_ID'] = str(project.id)

    create_response = client.post('/openfarmplanner/api/planting-plans/', data={})
    assert create_response.status_code == 400, create_response.content
