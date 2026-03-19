from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProjectSettings
from farm.models import Project, ProjectInvitation, ProjectMembership, Location

User = get_user_model()


class ProjectsApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(username='u1', email='u1@example.com', password='pass12345', is_active=True)
        self.other = User.objects.create_user(username='u2', email='u2@example.com', password='pass12345', is_active=True)
        self.invitee = User.objects.create_user(username='invitee', email='invitee@example.com', password='pass12345', is_active=True)
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

    def test_yield_calendar_is_scoped_to_active_project(self) -> None:
        location1 = Location.objects.create(name='L1', project=self.project)
        field1 = location1.fields.create(name='F1', project=self.project)
        bed1 = field1.beds.create(name='B1', area_sqm=10, project=self.project)

        location2 = Location.objects.create(name='L2', project=self.project2)
        field2 = location2.fields.create(name='F2', project=self.project2)
        bed2 = field2.beds.create(name='B2', area_sqm=10, project=self.project2)

        from farm.models import Culture, PlantingPlan

        culture1 = Culture.objects.create(name='Karotte', expected_yield=12, project=self.project)
        culture2 = Culture.objects.create(name='Tomate', expected_yield=99, project=self.project2)

        plan1 = PlantingPlan.objects.create(
            culture=culture1,
            bed=bed1,
            planting_date='2026-03-01',
            project=self.project,
        )
        plan2 = PlantingPlan.objects.create(
            culture=culture2,
            bed=bed2,
            planting_date='2026-03-01',
            project=self.project2,
        )
        PlantingPlan.objects.filter(id=plan1.id).update(harvest_date='2026-03-03', harvest_end_date='2026-03-06')
        PlantingPlan.objects.filter(id=plan2.id).update(harvest_date='2026-03-03', harvest_end_date='2026-03-06')

        response = self.client.get('/openfarmplanner/api/yield-calendar/?year=2026', HTTP_X_PROJECT_ID=str(self.project.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['cultures'][0]['culture_name'], 'Karotte')

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
        self.assertEqual(response.data['code'], 'invitation_sent')

    def test_member_cannot_invite(self) -> None:
        ProjectMembership.objects.update_or_create(user=self.user, project=self.project, defaults={'role': 'member'})
        response = self.client.post(
            f'/openfarmplanner/api/projects/{self.project.id}/invitations/',
            {'email': 'invitee@example.com', 'role': 'member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invitation_for_existing_member_is_rejected(self) -> None:
        ProjectMembership.objects.create(user=self.invitee, project=self.project, role='member')
        response = self.client.post(
            f'/openfarmplanner/api/projects/{self.project.id}/invitations/',
            {'email': 'invitee@example.com', 'role': 'member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'already_member')

    def test_second_open_invitation_is_resent_not_duplicated(self) -> None:
        first = self.client.post(
            f'/openfarmplanner/api/projects/{self.project.id}/invitations/',
            {'email': 'invitee@example.com', 'role': 'member'},
            format='json',
        )
        second = self.client.post(
            f'/openfarmplanner/api/projects/{self.project.id}/invitations/',
            {'email': 'INVITEE@example.com', 'role': 'admin'},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data['code'], 'invitation_resent')
        self.assertEqual(ProjectInvitation.objects.filter(project=self.project, email_normalized='invitee@example.com', status='pending').count(), 1)

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

    def test_accept_invitation_success(self) -> None:
        invitation = ProjectInvitation.objects.create(
            project=self.project,
            email='invitee@example.com',
            role='member',
            token='token123',
            invited_by=self.user,
            expires_at=timezone.now() + timedelta(days=14),
        )
        self.client.post('/openfarmplanner/api/auth/logout/')
        self.client.post('/openfarmplanner/api/auth/login/', {'email': 'invitee@example.com', 'password': 'pass12345'}, format='json')

        response = self.client.post(f'/openfarmplanner/api/project-invitations/{invitation.token}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['code'], 'accepted')
        self.assertTrue(ProjectMembership.objects.filter(project=self.project, user=self.invitee).exists())

    def test_accept_invitation_email_mismatch(self) -> None:
        invitation = ProjectInvitation.objects.create(
            project=self.project,
            email='third@example.com',
            role='member',
            token='token-mismatch',
            invited_by=self.user,
            expires_at=timezone.now() + timedelta(days=14),
        )
        response = self.client.post(f'/openfarmplanner/api/project-invitations/{invitation.token}/accept/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'email_mismatch')

    def test_expired_invitation_cannot_be_accepted(self) -> None:
        invitation = ProjectInvitation.objects.create(
            project=self.project,
            email=self.user.email,
            role='member',
            token='token-expired',
            invited_by=self.other,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        response = self.client.post(f'/openfarmplanner/api/project-invitations/{invitation.token}/accept/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'expired')

    def test_revoked_invitation_cannot_be_accepted(self) -> None:
        invitation = ProjectInvitation.objects.create(
            project=self.project,
            email=self.user.email,
            role='member',
            token='token-revoked',
            invited_by=self.other,
            expires_at=timezone.now() + timedelta(days=14),
            status='revoked',
            revoked_at=timezone.now(),
        )
        response = self.client.post(f'/openfarmplanner/api/project-invitations/{invitation.token}/accept/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'revoked')

    def test_accept_is_idempotent(self) -> None:
        invitation = ProjectInvitation.objects.create(
            project=self.project,
            email=self.user.email,
            role='member',
            token='token-idempotent',
            invited_by=self.other,
            expires_at=timezone.now() + timedelta(days=14),
        )

        first = self.client.post(f'/openfarmplanner/api/project-invitations/{invitation.token}/accept/')
        second = self.client.post(f'/openfarmplanner/api/project-invitations/{invitation.token}/accept/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data['code'], 'already_member')
        self.assertEqual(ProjectMembership.objects.filter(project=self.project, user=self.user).count(), 1)

    def test_public_status_handles_invalid_token(self) -> None:
        response = self.client.get('/openfarmplanner/api/project-invitations/does-not-exist/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['code'], 'invalid_token')

    def test_admin_can_revoke_invitation(self) -> None:
        invitation = ProjectInvitation.objects.create(
            project=self.project,
            email='invitee@example.com',
            role='member',
            token='token-revoke',
            invited_by=self.user,
            expires_at=timezone.now() + timedelta(days=14),
        )
        response = self.client.post(f'/openfarmplanner/api/projects/{self.project.id}/invitations/{invitation.id}/revoke/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, 'revoked')

    def test_admin_can_change_member_role(self) -> None:
        member = ProjectMembership.objects.create(user=self.invitee, project=self.project, role='member')
        response = self.client.patch(
            f'/openfarmplanner/api/projects/{self.project.id}/members/',
            {'membership_id': member.id, 'role': 'admin'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        member.refresh_from_db()
        self.assertEqual(member.role, 'admin')

    def test_cannot_demote_last_admin(self) -> None:
        own_membership = ProjectMembership.objects.get(user=self.user, project=self.project)
        response = self.client.patch(
            f'/openfarmplanner/api/projects/{self.project.id}/members/',
            {'membership_id': own_membership.id, 'role': 'member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_remove_member(self) -> None:
        member = ProjectMembership.objects.create(user=self.invitee, project=self.project, role='member')
        response = self.client.delete(
            f'/openfarmplanner/api/projects/{self.project.id}/members/',
            {'membership_id': member.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProjectMembership.objects.filter(id=member.id).exists())

    def test_cannot_remove_self_from_project_settings(self) -> None:
        own_membership = ProjectMembership.objects.get(user=self.user, project=self.project)
        response = self.client.delete(
            f'/openfarmplanner/api/projects/{self.project.id}/members/',
            {'membership_id': own_membership.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
