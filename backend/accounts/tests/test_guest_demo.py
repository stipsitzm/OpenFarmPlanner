from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.guest_demo import create_guest_demo_session
from accounts.models import GuestDemoSession
from farm.models import Culture, Project

User = get_user_model()


class GuestDemoApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def test_start_creates_an_isolated_authenticated_demo(self) -> None:
        response = self.client.post('/openfarmplanner/api/auth/guest-demo/start/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_guest_demo'])
        self.assertIsNotNone(response.data['guest_demo_session_id'])
        project = Project.objects.get(id=response.data['resolved_project_id'])
        self.assertEqual(project.name, 'Solawi Sonnenacker')
        self.assertGreater(Culture.objects.filter(project=project).count(), 0)
        self.assertEqual(response.data['pending_consents'], [])

    def test_each_start_receives_its_own_workspace(self) -> None:
        first = self.client.post('/openfarmplanner/api/auth/guest-demo/start/', {}, format='json')
        second_client = APIClient()
        second = second_client.post('/openfarmplanner/api/auth/guest-demo/start/', {}, format='json')

        self.assertNotEqual(first.data['resolved_project_id'], second.data['resolved_project_id'])

    def test_end_deletes_current_guest_workspace(self) -> None:
        started = self.client.post('/openfarmplanner/api/auth/guest-demo/start/', {}, format='json')
        project_id = started.data['resolved_project_id']

        response = self.client.post('/openfarmplanner/api/auth/guest-demo/end/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Project.objects.filter(id=project_id).exists())

    def test_expired_session_is_removed_by_cleanup_command(self) -> None:
        demo_session = create_guest_demo_session()
        demo_session.expires_at = timezone.now() - timedelta(seconds=1)
        demo_session.save(update_fields=['expires_at'])

        from django.core.management import call_command

        call_command('cleanup_guest_demo_sessions')
        self.assertFalse(GuestDemoSession.objects.filter(id=demo_session.id).exists())
