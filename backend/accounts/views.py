from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import translation
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.translation import gettext as _
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    ActivateSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendActivationSerializer,
    UserSerializer,
    normalize_email_lower,
)

User = get_user_model()


def _de(message: str) -> str:
    with translation.override('de'):
        return _(message)


GENERIC_EMAIL_SENT_MESSAGE = _de(_('If the account exists, an email has been sent.'))


def _normalize_email(email: str) -> str:
    return normalize_email_lower(email)


def _build_frontend_link(path_with_query: str) -> str:
    base_url = settings.FRONTEND_URL.rstrip('/')
    if not path_with_query.startswith('/'):
        path_with_query = f'/{path_with_query}'
    return f'{base_url}{path_with_query}'


def _send_activation_email(user: User) -> None:
    uid = urlsafe_base64_encode(str(user.pk).encode('utf-8'))
    token = default_token_generator.make_token(user)
    activation_link = _build_frontend_link(f'/activate?uid={uid}&token={token}')
    with translation.override('de'):
        subject = _('Activate your OpenFarmPlanner account')
        body = render_to_string('accounts/emails/activation_email.txt', {
            'activation_link': activation_link,
            'user': user,
        })
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])


def _send_password_reset_email(user: User) -> None:
    uid = urlsafe_base64_encode(str(user.pk).encode('utf-8'))
    token = default_token_generator.make_token(user)
    reset_link = _build_frontend_link(f'/reset-password?uid={uid}&token={token}')
    with translation.override('de'):
        subject = _('Reset your OpenFarmPlanner password')
        body = render_to_string('accounts/emails/password_reset_email.txt', {
            'reset_link': reset_link,
            'user': user,
        })
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])


def _decode_uid(uid: str) -> int | None:
    try:
        return int(force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError):
        return None


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        return Response({'detail': _de(_('CSRF cookie set'))})


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        _send_activation_email(user)
        return Response({'detail': _de(_('Registration successful. Please check your email to activate your account.'))}, status=status.HTTP_201_CREATED)


class ActivateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = ActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = _decode_uid(serializer.validated_data['uid'])
        if uid is None:
            return Response({'detail': _de(_('Invalid activation link.'))}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(User, pk=uid)
        token = serializer.validated_data['token']
        if not default_token_generator.check_token(user, token):
            return Response({'detail': _de(_('Invalid or expired activation token.'))}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = True
        user.save(update_fields=['is_active'])
        login(request, user)
        return Response(UserSerializer(user).data)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = _normalize_email(serializer.validated_data['email'])
        password = serializer.validated_data['password']

        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.check_password(password):
            return Response({'detail': _de(_('Invalid credentials.'))}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'detail': _de(_('Account is not activated yet.'))}, status=status.HTTP_403_FORBIDDEN)

        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request: Request) -> Response:
        logout(request)
        return Response({'detail': _de(_('Logged out.'))})


class MeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        if not request.user.is_authenticated:
            return Response({'detail': _de(_('Authentication credentials were not provided.'))}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(UserSerializer(request.user).data)


class ResendActivationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = ResendActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = _normalize_email(serializer.validated_data['email'])

        user = User.objects.filter(email__iexact=email).first()
        if user is not None and not user.is_active:
            _send_activation_email(user)

        return Response({'detail': GENERIC_EMAIL_SENT_MESSAGE})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = _normalize_email(serializer.validated_data['email'])

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            _send_password_reset_email(user)

        return Response({'detail': GENERIC_EMAIL_SENT_MESSAGE})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = _decode_uid(serializer.validated_data['uid'])
        if uid is None:
            return Response({'detail': _de(_('Invalid reset link.'))}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=uid, is_active=True).first()
        if user is None:
            return Response({'detail': _de(_('Invalid reset link.'))}, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data['token']
        if not default_token_generator.check_token(user, token):
            return Response({'detail': _de(_('Invalid or expired reset token.'))}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password'])
        return Response({'detail': _de(_('Password has been reset successfully.'))})
