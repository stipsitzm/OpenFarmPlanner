from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from accounts.models import UserProjectSettings
from farm.models import Bed, Culture, Location, PlantingPlan, Project, ProjectMembership, Supplier
from farm.services.demo_project import (
    DEMO_PROJECT_DESCRIPTION,
    DEMO_PROJECT_NAME,
    DEMO_PROJECT_SLUG,
    create_or_reset_demo_project,
    create_personal_demo_project,
)

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

    def test_create_personal_demo_project_creates_owned_editable_project(self) -> None:
        user = User.objects.create_user(username='owner', email='owner@example.com', password='pass12345', is_active=True)

        result = create_personal_demo_project(user=user)

        self.assertTrue(result.created_project)
        self.assertEqual(result.project.name, DEMO_PROJECT_NAME)
        self.assertEqual(result.project.description, DEMO_PROJECT_DESCRIPTION)
        self.assertTrue(ProjectMembership.objects.filter(user=user, project=result.project, role='admin').exists())
        settings_obj = UserProjectSettings.objects.get(user=user)
        self.assertEqual(settings_obj.default_project_id, result.project.id)
        self.assertEqual(settings_obj.last_project_id, result.project.id)
        self.assertEqual(Location.objects.filter(project=result.project).count(), 2)
        self.assertEqual(Bed.objects.filter(project=result.project).count(), 12)
        self.assertEqual(Culture.objects.filter(project=result.project).count(), 8)
        self.assertEqual(PlantingPlan.objects.filter(project=result.project).count(), 12)

    def test_create_personal_demo_project_is_idempotent_for_same_user(self) -> None:
        user = User.objects.create_user(username='repeat', email='repeat@example.com', password='pass12345', is_active=True)

        first = create_personal_demo_project(user=user)
        second = create_personal_demo_project(user=user)

        self.assertEqual(second.project.id, first.project.id)
        self.assertFalse(second.created_project)
        self.assertEqual(Project.objects.filter(memberships__user=user, name=DEMO_PROJECT_NAME).count(), 1)
        self.assertEqual(Location.objects.filter(project=first.project).count(), 2)

    def test_two_users_receive_separate_demo_projects_and_data(self) -> None:
        first_user = User.objects.create_user(username='first', email='first@example.com', password='pass12345', is_active=True)
        second_user = User.objects.create_user(username='second', email='second@example.com', password='pass12345', is_active=True)

        first = create_personal_demo_project(user=first_user)
        second = create_personal_demo_project(user=second_user)

        self.assertNotEqual(first.project.id, second.project.id)
        self.assertTrue(ProjectMembership.objects.filter(user=first_user, project=first.project, role='admin').exists())
        self.assertTrue(ProjectMembership.objects.filter(user=second_user, project=second.project, role='admin').exists())
        self.assertFalse(ProjectMembership.objects.filter(user=first_user, project=second.project).exists())
        self.assertEqual(Location.objects.filter(project=first.project).count(), 2)
        self.assertEqual(Location.objects.filter(project=second.project).count(), 2)

    def test_personal_demo_project_creation_rolls_back_on_populate_error(self) -> None:
        user = User.objects.create_user(username='broken', email='broken@example.com', password='pass12345', is_active=True)

        with patch('farm.services.demo_project.populate_demo_project', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                create_personal_demo_project(user=user)

        self.assertFalse(Project.objects.filter(memberships__user=user, name=DEMO_PROJECT_NAME).exists())
        self.assertFalse(UserProjectSettings.objects.filter(user=user).exists())
