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
