from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase


class AuthApiTest(APITestCase):
    def setUp(self) -> None:
        self.password = 'safe-password-123'
        self.user = User.objects.create_user(username='demo', password=self.password)

    def test_me_requires_authentication(self) -> None:
        response = self.client.get('/openfarmplanner/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_register_logs_user_in(self) -> None:
        csrf_response = self.client.get('/openfarmplanner/api/auth/csrf/')
        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            '/openfarmplanner/api/auth/register/',
            {
                'username': 'newuser',
                'password': 'new-safe-password-123',
                'password_confirm': 'new-safe-password-123',
                'email': 'newuser@example.com',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], 'newuser')

        me_response = self.client.get('/openfarmplanner/api/auth/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data['username'], 'newuser')

    def test_login_logout_and_me(self) -> None:
        csrf_response = self.client.get('/openfarmplanner/api/auth/csrf/')
        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)

        login_response = self.client.post(
            '/openfarmplanner/api/auth/login/',
            {'username': self.user.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.data['username'], self.user.username)

        me_response = self.client.get('/openfarmplanner/api/auth/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data['username'], self.user.username)

        logout_response = self.client.post('/openfarmplanner/api/auth/logout/', {}, format='json')
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        me_after_logout = self.client.get('/openfarmplanner/api/auth/me/')
        self.assertEqual(me_after_logout.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_account_removes_user_and_session(self) -> None:
        csrf_response = self.client.get('/openfarmplanner/api/auth/csrf/')
        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)

        login_response = self.client.post(
            '/openfarmplanner/api/auth/login/',
            {'username': self.user.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete('/openfarmplanner/api/auth/account/', {}, format='json')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        self.assertFalse(User.objects.filter(username=self.user.username).exists())

        me_after_delete = self.client.get('/openfarmplanner/api/auth/me/')
        self.assertEqual(me_after_delete.status_code, status.HTTP_401_UNAUTHORIZED)
