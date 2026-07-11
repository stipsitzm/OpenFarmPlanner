from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from farm.models import Bed, Culture, Location, PlantingPlan, Project, ProjectMembership, Supplier
from farm.services.demo_project import DEMO_PROJECT_SLUG, create_or_reset_demo_project

User = get_user_model()


class DemoProjectServiceTests(TestCase):
    def test_create_or_reset_demo_project_replaces_project_data(self) -> None:
        result = create_or_reset_demo_project()

        self.assertEqual(result.project.slug, DEMO_PROJECT_SLUG)
        self.assertTrue(ProjectMembership.objects.filter(user=result.user, project=result.project, role='admin').exists())
        self.assertEqual(Location.objects.filter(project=result.project).count(), 2)
        self.assertEqual(Bed.objects.filter(project=result.project).count(), 12)
        self.assertEqual(Culture.objects.filter(project=result.project).count(), 8)
        self.assertEqual(PlantingPlan.objects.filter(project=result.project).count(), 12)
        self.assertEqual(Supplier.objects.filter(project=result.project).count(), 3)
        self.assertTrue(
            Culture.objects.filter(
                project=result.project,
                name='Karotte',
                selected_seed_demand_supplier__isnull=False,
                supplier_data__packaging_sizes__0__size_unit='g',
            ).exists()
        )

        Location.objects.create(name='Temporary Location', project=result.project)
        second_result = create_or_reset_demo_project()

        self.assertEqual(second_result.project.id, result.project.id)
        self.assertFalse(Location.objects.filter(project=result.project, name='Temporary Location').exists())
        self.assertEqual(Location.objects.filter(project=result.project).count(), 2)

    def test_management_command_seeds_requested_demo_project(self) -> None:
        call_command(
            'seed_demo_project',
            project_slug='command-demo',
            user_email='command-demo@example.local',
            username='command-demo-user',
            password='CommandDemoPass123!',
        )

        project = Project.objects.get(slug='command-demo')
        user = User.objects.get(email='command-demo@example.local')
        self.assertEqual(project.name, 'Solawi Sonnenacker 2026')
        self.assertTrue(ProjectMembership.objects.filter(project=project, user=user, role='admin').exists())
        self.assertEqual(PlantingPlan.objects.filter(project=project).count(), 12)
