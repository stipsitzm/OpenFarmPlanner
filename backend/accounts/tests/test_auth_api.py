from __future__ import annotations

from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountDeletionRequest, PendingActivation

User = get_user_model()


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', FRONTEND_URL='http://localhost:5173')
class AuthApiTest(APITestCase):
    def setUp(self) -> None:
        self.password = 'safe-password-123'
        self.user = User.objects.create_user(
            username='demo',
            email='demo@example.com',
            password=self.password,
            is_active=True,
        )

    def test_registration_and_duplicate_prevention(self) -> None:
        response = self.client.post(
            '/openfarmplanner/api/auth/register/',
            {
                'email': 'NEW@Example.com',
                'display_name': 'New User',
                'password': 'new-safe-password-123',
                'password_confirm': 'new-safe-password-123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email='new@example.com')
        self.assertFalse(created.is_active)
        self.assertEqual(created.first_name, 'New User')
        self.assertEqual(len(mail.outbox), 1)
        pending = PendingActivation.objects.get(user=created)
        expected = timezone.now() + timedelta(days=7)
        self.assertLess(abs((pending.activation_expires_at - expected).total_seconds()), 15)
        activation_email_body = mail.outbox[0].body
        self.assertIn('/activate?uid=', activation_email_body)
        self.assertIn('&token=', activation_email_body)
        self.assertNotIn('&amp;token=', activation_email_body)

        duplicate = self.client.post(
            '/openfarmplanner/api/auth/register/',
            {
                'email': 'new@example.com',
                'password': 'new-safe-password-123',
                'password_confirm': 'new-safe-password-123',
            },
            format='json',
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_activation_success_and_invalid_token(self) -> None:
        register_response = self.client.post(
            '/openfarmplanner/api/auth/register/',
            {
                'email': 'pending@example.com',
                'display_name': 'Pending User',
                'password': self.password,
                'password_confirm': self.password,
            },
            format='json',
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email='pending@example.com')
        pending = PendingActivation.objects.get(user=user)
        self.assertIsNotNone(pending.activation_expires_at)

        uid = urlsafe_base64_encode(str(user.pk).encode('utf-8'))
        token = default_token_generator.make_token(user)

        invalid = self.client.post('/openfarmplanner/api/auth/activate/', {'uid': uid, 'token': 'bad-token'}, format='json')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        valid = self.client.post('/openfarmplanner/api/auth/activate/', {'uid': uid, 'token': token}, format='json')
        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertFalse(PendingActivation.objects.filter(user=user).exists())

    def test_login_success_and_block_before_activation(self) -> None:
        blocked_user = User.objects.create_user(
            username='inactive',
            email='inactive@example.com',
            password=self.password,
            is_active=False,
        )

        blocked = self.client.post(
            '/openfarmplanner/api/auth/login/',
            {'email': blocked_user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

        success = self.client.post(
            '/openfarmplanner/api/auth/login/',
            {'email': 'DEMO@EXAMPLE.COM', 'password': self.password},
            format='json',
        )
        self.assertEqual(success.status_code, status.HTTP_200_OK)
        self.assertEqual(success.data['email'], self.user.email)

    def test_logout_and_me(self) -> None:
        self.client.post('/openfarmplanner/api/auth/login/', {'email': self.user.email, 'password': self.password}, format='json')

        me_response = self.client.get('/openfarmplanner/api/auth/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)

        logout_response = self.client.post('/openfarmplanner/api/auth/logout/', {}, format='json')
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        me_after_logout = self.client.get('/openfarmplanner/api/auth/me/')
        self.assertEqual(me_after_logout.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_reset_request_and_confirm(self) -> None:
        reset_request = self.client.post('/openfarmplanner/api/auth/password-reset/', {'email': self.user.email}, format='json')
        self.assertEqual(reset_request.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        uid = urlsafe_base64_encode(str(self.user.pk).encode('utf-8'))
        token = default_token_generator.make_token(self.user)
        confirm = self.client.post(
            '/openfarmplanner/api/auth/password-reset-confirm/',
            {
                'uid': uid,
                'token': token,
                'password': 'even-safer-password-123',
                'password_confirm': 'even-safer-password-123',
            },
            format='json',
        )
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)

        login_response = self.client.post(
            '/openfarmplanner/api/auth/login/',
            {'email': self.user.email, 'password': 'even-safer-password-123'},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_resend_activation_does_not_leak_user_existence(self) -> None:
        inactive = User.objects.create_user(
            username='pending2',
            email='pending2@example.com',
            password=self.password,
            is_active=False,
        )
        old_expiry = timezone.now() + timedelta(days=1)
        PendingActivation.objects.update_or_create(
            user=inactive,
            defaults={'activation_expires_at': old_expiry},
        )

        first = self.client.post('/openfarmplanner/api/auth/resend-activation/', {'email': inactive.email}, format='json')
        second = self.client.post('/openfarmplanner/api/auth/resend-activation/', {'email': 'unknown@example.com'}, format='json')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['detail'], second.data['detail'])

        refreshed_expiry = PendingActivation.objects.get(user=inactive).activation_expires_at
        self.assertGreater(refreshed_expiry, old_expiry)

    def test_cleanup_command_keeps_non_expired_inactive_user(self) -> None:
        inactive = User.objects.create_user(
            username='inactive_keep',
            email='inactive_keep@example.com',
            password=self.password,
            is_active=False,
        )
        PendingActivation.objects.update_or_create(
            user=inactive,
            defaults={'activation_expires_at': timezone.now() + timedelta(days=2)},
        )

        output = StringIO()
        call_command('delete_expired_inactive_users', stdout=output)

        self.assertTrue(User.objects.filter(pk=inactive.pk).exists())
        self.assertIn('Found 0 expired inactive users.', output.getvalue())

    def test_cleanup_command_deletes_expired_inactive_user(self) -> None:
        inactive = User.objects.create_user(
            username='inactive_delete',
            email='inactive_delete@example.com',
            password=self.password,
            is_active=False,
        )
        PendingActivation.objects.update_or_create(
            user=inactive,
            defaults={'activation_expires_at': timezone.now() - timedelta(days=1)},
        )

        output = StringIO()
        call_command('delete_expired_inactive_users', stdout=output)

        self.assertFalse(User.objects.filter(pk=inactive.pk).exists())
        self.assertIn('Found 1 expired inactive users.', output.getvalue())
        self.assertIn('Deleted 1 expired inactive users.', output.getvalue())

    def test_cleanup_command_never_deletes_active_user(self) -> None:
        active = User.objects.create_user(
            username='active_keep',
            email='active_keep@example.com',
            password=self.password,
            is_active=True,
        )
        PendingActivation.objects.update_or_create(
            user=active,
            defaults={'activation_expires_at': timezone.now() - timedelta(days=3)},
        )

        call_command('delete_expired_inactive_users')

        self.assertTrue(User.objects.filter(pk=active.pk).exists())


    def test_account_delete_request_requires_password(self) -> None:
        self.client.post('/openfarmplanner/api/auth/login/', {'email': self.user.email, 'password': self.password}, format='json')
        response = self.client.post('/openfarmplanner/api/auth/account/delete-request/', {'password': 'wrong'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_account_delete_request_and_login_block(self) -> None:
        self.client.post('/openfarmplanner/api/auth/login/', {'email': self.user.email, 'password': self.password}, format='json')
        response = self.client.post('/openfarmplanner/api/auth/account/delete-request/', {'password': self.password}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deletion = AccountDeletionRequest.objects.get(user=self.user)
        self.assertIsNotNone(deletion.scheduled_deletion_at)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

        blocked = self.client.post('/openfarmplanner/api/auth/login/', {'email': self.user.email, 'password': self.password}, format='json')
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(blocked.data.get('code'), 'account_pending_deletion')

    def test_account_restore_within_grace_period(self) -> None:
        self.client.post('/openfarmplanner/api/auth/login/', {'email': self.user.email, 'password': self.password}, format='json')
        self.client.post('/openfarmplanner/api/auth/account/delete-request/', {'password': self.password}, format='json')
        response = self.client.post(
            '/openfarmplanner/api/auth/account/restore/',
            {'email': self.user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        deletion = AccountDeletionRequest.objects.get(user=self.user)
        self.assertIsNone(deletion.deletion_requested_at)
        self.assertIsNone(deletion.scheduled_deletion_at)

    def test_account_restore_after_grace_period_fails(self) -> None:
        deletion = AccountDeletionRequest.objects.create(
            user=self.user,
            deletion_requested_at=timezone.now() - timedelta(days=15),
            scheduled_deletion_at=timezone.now() - timedelta(days=1),
        )
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])

        response = self.client.post(
            '/openfarmplanner/api/auth/account/restore/',
            {'email': self.user.email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_purge_deleted_accounts_anonymizes_and_is_idempotent(self) -> None:
        AccountDeletionRequest.objects.create(
            user=self.user,
            deletion_requested_at=timezone.now() - timedelta(days=20),
            scheduled_deletion_at=timezone.now() - timedelta(days=2),
        )
        output = StringIO()
        call_command('purge_deleted_accounts', stdout=output)
        self.user.refresh_from_db()
        deletion = AccountDeletionRequest.objects.get(user=self.user)
        self.assertIsNotNone(deletion.deleted_at)
        self.assertFalse(self.user.is_active)
        self.assertTrue(self.user.email.startswith('deleted-user-'))

        second = StringIO()
        call_command('purge_deleted_accounts', stdout=second)
        self.assertIn('Finalized 0 accounts.', second.getvalue())
