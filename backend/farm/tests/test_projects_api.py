from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProjectSettings
from farm.models import Project, ProjectMembership, Location, ProjectInvitation

User = get_user_model()


class ProjectsApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username='u1', email='u1@example.com', password='pass12345', is_active=True)
        self.other = User.objects.create_user(username='u2', email='u2@example.com', password='pass12345', is_active=True)
        self.project = Project.objects.create(name='P1', slug='p1')
        self.project2 = Project.objects.create(name='P2', slug='p2')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        ProjectMembership.objects.create(user=self.other, project=self.project2, role='admin')
        UserProjectSettings.objects.create(user=self.user, default_project=self.project, last_project=self.project)
        self.client.post('/openfarmplanner/api/auth/login/', {'email': 'u1@example.com', 'password': 'pass12345'}, format='json')

    def test_project_scoping_with_header(self) -> None:
        Location.objects.create(name='L1', project=self.project)
        Location.objects.create(name='L2', project=self.project2)

        response = self.client.get('/openfarmplanner/api/locations/', HTTP_X_PROJECT_ID=str(self.project.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_switch_project_updates_last_project(self) -> None:
        ProjectMembership.objects.create(user=self.user, project=self.project2, role='member')

        response = self.client.post('/openfarmplanner/api/projects-switch/', {'project_id': self.project2.id}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['resolved_project_id'], self.project2.id)
        self.assertEqual(response.data['last_project_id'], self.project2.id)

        settings_obj = UserProjectSettings.objects.get(user=self.user)
        self.assertEqual(settings_obj.last_project_id, self.project2.id)


    def test_create_project_without_slug_succeeds(self) -> None:
        response = self.client.post('/openfarmplanner/api/projects/', {'name': 'Neues Projekt', 'description': ''}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Neues Projekt')
        self.assertTrue(response.data['slug'])

    def test_admin_can_invite_member(self) -> None:
        response = self.client.post(
            f'/openfarmplanner/api/projects/{self.project.id}/invitations/',
            {'email': 'invitee@example.com', 'role': 'member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend')
    def test_invitation_returns_mail_not_sent_on_console_backend(self) -> None:
        response = self.client.post(
            f'/openfarmplanner/api/projects/{self.project.id}/invitations/',
            {'email': 'invitee@example.com', 'role': 'member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['mail_sent'])
        self.assertIn('invite_link', response.data)
        self.assertEqual(response.data['email_backend'], 'django.core.mail.backends.console.EmailBackend')

    def test_member_cannot_invite(self) -> None:
        ProjectMembership.objects.update_or_create(
            user=self.user,
            project=self.project,
            defaults={'role': 'member'},
        )
        response = self.client.post(
            f'/openfarmplanner/api/projects/{self.project.id}/invitations/',
            {'email': 'invitee@example.com', 'role': 'member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_accept_invitation_is_idempotent_for_same_user(self) -> None:
        invitation = ProjectInvitation.objects.create(
            project=self.project,
            email=self.user.email,
            role='member',
            token='token123',
            invited_by=self.other,
            expires_at=timezone.now() + timedelta(days=14),
        )

        first = self.client.post('/openfarmplanner/api/project-invitations/accept/', {'token': invitation.token}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['project_id'], self.project.id)

        second = self.client.post('/openfarmplanner/api/project-invitations/accept/', {'token': invitation.token}, format='json')
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data['project_id'], self.project.id)

