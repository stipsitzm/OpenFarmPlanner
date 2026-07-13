from __future__ import annotations

from datetime import timedelta
import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone, translation
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.translation import gettext as _
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from config.frontend_urls import build_public_frontend_url

from .consent import record_acceptance
from .models import AccountDeletionRequest, AccountEmailChangeRequest, PendingActivation, PublicProfile
from .serializers import (
    AccountEmailChangeConfirmSerializer,
    AccountEmailChangeRequestSerializer,
    AccountDeleteRequestSerializer,
    AccountPasswordChangeSerializer,
    AccountProfileSerializer,
    AccountPublicProfileSerializer,
    AccountRestoreSerializer,
    ActivateSerializer,
    ConsentAcceptSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendActivationSerializer,
    UserSerializer,
    normalize_email_lower,
)

User = get_user_model()
ACTIVATION_EXPIRY_DAYS = 7
ACCOUNT_DELETION_GRACE_DAYS = 14
logger = logging.getLogger(__name__)


def _de(message: str) -> str:
    with translation.override('de'):
        return _(message)


GENERIC_EMAIL_SENT_MESSAGE = _de('If the account exists, an email has been sent.')
REGISTRATION_EMAIL_SENT_MESSAGE = _de('Registration successful. Please check your email to activate your account.')
REGISTRATION_LOCAL_EMAIL_MESSAGE = _de(
    'Registration successful. In local development, the activation email is written to the server log/terminal and is not delivered to an inbox.'
)
REGISTRATION_EMAIL_SEND_FAILED_MESSAGE = (
    f'Dein Konto wurde erstellt, aber die Aktivierungs-E-Mail konnte nicht gesendet werden. '
    f'Bitte kontaktiere [{settings.SUPPORT_CONTACT_EMAIL}](mailto:{settings.SUPPORT_CONTACT_EMAIL}), '
    'damit wir dein Konto aktivieren oder dir den Link erneut senden können.'
)
GENERIC_EMAIL_SEND_FAILED_MESSAGE = (
    f'Die E-Mail konnte nicht gesendet werden. '
    f'Bitte kontaktiere [{settings.SUPPORT_CONTACT_EMAIL}](mailto:{settings.SUPPORT_CONTACT_EMAIL}).'
)
EMAIL_CHANGE_CONFIRMATION_SENT_MESSAGE = _de(
    'Wir haben dir einen Bestätigungslink an die neue E-Mail-Adresse gesendet. '
    'Deine aktuelle Login-E-Mail bleibt aktiv, bis du den Link bestätigst.'
)
EMAIL_CHANGE_CONFIRMATION_SUCCESS_MESSAGE = _de('Deine E-Mail-Adresse wurde erfolgreich aktualisiert.')
EMAIL_CHANGE_INVALID_LINK_MESSAGE = _de('Der Bestätigungslink ist ungültig oder abgelaufen.')
PASSWORD_UPDATED_MESSAGE = _de('Dein Passwort wurde erfolgreich geändert.')
PROFILE_UPDATED_MESSAGE = _de('Dein Profil wurde erfolgreich gespeichert.')


def _uses_local_non_delivery_email_backend() -> bool:
    return settings.EMAIL_BACKEND in {
        'django.core.mail.backends.console.EmailBackend',
        'django.core.mail.backends.filebased.EmailBackend',
        'django.core.mail.backends.dummy.EmailBackend',
    }


def _normalize_email(email: str) -> str:
    return normalize_email_lower(email)


def _activation_deadline() -> timezone.datetime:
    """
    Return the activation deadline for newly registered inactive users.

    :return: Datetime representing now plus the configured activation window.
    """
    return timezone.now() + timedelta(days=ACTIVATION_EXPIRY_DAYS)


def _set_activation_expiry(user: User) -> None:
    """
    Create or refresh the activation expiry record for a user.

    :param user: User awaiting activation.
    :return: None.
    """
    PendingActivation.objects.update_or_create(
        user=user,
        defaults={'activation_expires_at': _activation_deadline()},
    )


def _clear_activation_expiry(user: User) -> None:
    """
    Remove activation expiry metadata after successful activation.

    :param user: Activated user.
    :return: None.
    """
    PendingActivation.objects.filter(user=user).delete()


def _build_frontend_link(path_with_query: str) -> str:
    return build_public_frontend_url(path_with_query)


def _build_frontend_token_link(path: str, user: User) -> str:
    uid = urlsafe_base64_encode(str(user.pk).encode('utf-8'))
    token = default_token_generator.make_token(user)
    return _build_frontend_link(f'{path}?uid={uid}&token={token}')


def _registration_success_message() -> str:
    return REGISTRATION_LOCAL_EMAIL_MESSAGE if _uses_local_non_delivery_email_backend() else REGISTRATION_EMAIL_SENT_MESSAGE


def _logout_all_user_sessions(user_id: int) -> None:
    """
    Delete all active sessions for a specific user.

    :param user_id: User primary key to invalidate sessions for.
    :return: None.
    """
    for session in Session.objects.filter(expire_date__gte=timezone.now()).iterator():
        try:
            session_user_id = session.get_decoded().get('_auth_user_id')
        except Exception:  # noqa: BLE001
            continue
        if str(session_user_id) == str(user_id):
            session.delete()


def _send_activation_email(user: User) -> None:
    """
    Send multipart activation email with explicit sender metadata.

    Deliverability note: multipart (text + HTML) improves compatibility across clients
    and avoids HTML-only spam signals. We intentionally avoid no-reply senders so
    recipients can contact support via a monitored sender mailbox and mailbox providers
    see a trustworthy identity.
    """
    activation_link = _build_frontend_token_link('/activate', user)
    with translation.override('de'):
        subject = 'OpenFarmPlanner – Registrierung bestätigen'
        text_body = render_to_string('accounts/emails/activation_email.txt', {
            'activation_link': activation_link,
            'contact_email': settings.SUPPORT_CONTACT_EMAIL,
            'project_website': 'https://openfarmplanner.org',
            'project_name': 'OpenFarmPlanner',
            'user': user,
        })
        html_body = render_to_string('accounts/emails/activation_email.html', {
            'activation_link': activation_link,
            'contact_email': settings.SUPPORT_CONTACT_EMAIL,
            'project_website': 'https://openfarmplanner.org',
            'project_name': 'OpenFarmPlanner',
            'user': user,
        })
    send_mail(
        subject=subject,
        message=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_body,
        fail_silently=False,
    )


def _send_password_reset_email(user: User) -> None:
    reset_link = _build_frontend_token_link('/reset-password', user)
    with translation.override('de'):
        subject = _('Reset your OpenFarmPlanner password')
        body = render_to_string('accounts/emails/password_reset_email.txt', {
            'reset_link': reset_link,
            'user': user,
        })
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email])


def _send_email_change_confirmation_email(user: User, request_obj: AccountEmailChangeRequest) -> None:
    confirmation_link = _build_frontend_link(
        f'/confirm-email-change?uid={urlsafe_base64_encode(str(user.pk).encode("utf-8"))}'
        f'&token={default_token_generator.make_token(user)}'
        f'&request_id={request_obj.id}'
    )
    with translation.override('de'):
        subject = _('Confirm your OpenFarmPlanner email change')
        body = render_to_string('accounts/emails/email_change_confirmation_email.txt', {
            'confirmation_link': confirmation_link,
            'new_email': request_obj.new_email,
            'user': user,
        })
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [request_obj.new_email])


def _decode_uid(uid: str) -> int | None:
    try:
        return int(force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError):
        return None


def _validate_serializer_in_german(serializer) -> None:
    """Run DRF serializer validation with German locale activated."""
    with translation.override('de'):
        serializer.is_valid(raise_exception=True)


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        return Response({'detail': _de(_('CSRF cookie set'))})


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_register'

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        user = serializer.save()
        _set_activation_expiry(user)
        try:
            _send_activation_email(user)
        except Exception:  # noqa: BLE001
            logger.exception('Failed to send activation email after registration', extra={'user_id': user.id, 'email': user.email})
            return Response(
                {
                    'code': 'email_send_failed',
                    'message': REGISTRATION_EMAIL_SEND_FAILED_MESSAGE,
                    'detail': REGISTRATION_EMAIL_SEND_FAILED_MESSAGE,
                },
                status=status.HTTP_201_CREATED,
            )
        detail_message = _registration_success_message()
        return Response({'detail': detail_message}, status=status.HTTP_201_CREATED)


class ActivateView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_activation'

    def post(self, request: Request) -> Response:
        serializer = ActivateSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        uid = _decode_uid(serializer.validated_data['uid'])
        if uid is None:
            return Response({'detail': _de(_('Invalid activation link.'))}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(User, pk=uid)
        pending = PendingActivation.objects.filter(user=user).first()
        if pending is not None and pending.activation_expires_at < timezone.now():
            user.delete()
            return Response({'detail': _de(_('Invalid or expired activation token.'))}, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data['token']
        if not default_token_generator.check_token(user, token):
            return Response({'detail': _de(_('Invalid or expired activation token.'))}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = True
        user.save(update_fields=['is_active'])
        _clear_activation_expiry(user)
        login(request, user)
        return Response(UserSerializer(user).data)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_login'

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        _validate_serializer_in_german(serializer)

        email = _normalize_email(serializer.validated_data['email'])
        password = serializer.validated_data['password']

        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.check_password(password):
            return Response({'detail': _de(_('Invalid credentials.'))}, status=status.HTTP_401_UNAUTHORIZED)

        deletion = AccountDeletionRequest.objects.filter(user=user).first()
        if deletion and deletion.is_pending and deletion.scheduled_deletion_at is not None and deletion.scheduled_deletion_at > timezone.now():
            return Response(
                {
                    'detail': _de(_('This account is pending deletion. You can still restore it.')),
                    'code': 'account_pending_deletion',
                    'scheduled_deletion_at': deletion.scheduled_deletion_at.isoformat(),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

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


class ConsentAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = ConsentAcceptSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        record_acceptance(request.user, serializer.validated_data['document'])
        return Response(UserSerializer(request.user).data)


class AccountProfileView(APIView):
    def patch(self, request: Request) -> Response:
        serializer = AccountProfileSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        display_name = serializer.validated_data['display_name'].strip()
        request.user.first_name = display_name
        request.user.save(update_fields=['first_name'])
        return Response({'detail': PROFILE_UPDATED_MESSAGE, 'user': UserSerializer(request.user).data})


class AccountPublicProfileView(APIView):
    def patch(self, request: Request) -> Response:
        serializer = AccountPublicProfileSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        public_display_name = serializer.validated_data['public_display_name'].strip()
        PublicProfile.objects.update_or_create(user=request.user, defaults={'public_display_name': public_display_name})
        return Response({'detail': PROFILE_UPDATED_MESSAGE, 'user': UserSerializer(request.user).data})


class AccountEmailChangeRequestView(APIView):
    throttle_scope = 'auth_password_reset_request'

    def post(self, request: Request) -> Response:
        serializer = AccountEmailChangeRequestSerializer(data=request.data, context={'request': request})
        _validate_serializer_in_german(serializer)

        if not request.user.check_password(serializer.validated_data['current_password']):
            return Response({'detail': _de(_('Invalid password.'))}, status=status.HTTP_400_BAD_REQUEST)

        AccountEmailChangeRequest.objects.filter(user=request.user, confirmed_at__isnull=True).delete()
        email_change_request = AccountEmailChangeRequest.objects.create(
            user=request.user,
            new_email=serializer.validated_data['new_email'],
            expires_at=timezone.now() + timedelta(hours=24),
        )

        try:
            _send_email_change_confirmation_email(request.user, email_change_request)
        except Exception:  # noqa: BLE001
            logger.exception(
                'Failed to send email change confirmation',
                extra={'user_id': request.user.id, 'new_email': email_change_request.new_email},
            )
            email_change_request.delete()
            return Response(
                {
                    'code': 'email_send_failed',
                    'message': GENERIC_EMAIL_SEND_FAILED_MESSAGE,
                    'detail': GENERIC_EMAIL_SEND_FAILED_MESSAGE,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({'detail': EMAIL_CHANGE_CONFIRMATION_SENT_MESSAGE})


class AccountEmailChangeConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_password_reset_confirm'

    def post(self, request: Request) -> Response:
        serializer = AccountEmailChangeConfirmSerializer(data=request.data)
        _validate_serializer_in_german(serializer)

        uid = _decode_uid(serializer.validated_data['uid'])
        if uid is None:
            return Response({'detail': EMAIL_CHANGE_INVALID_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=uid, is_active=True).first()
        if user is None:
            return Response({'detail': EMAIL_CHANGE_INVALID_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        request_obj = AccountEmailChangeRequest.objects.filter(
            id=serializer.validated_data['request_id'],
            user=user,
            confirmed_at__isnull=True,
        ).first()
        if request_obj is None or request_obj.expires_at <= timezone.now():
            return Response({'detail': EMAIL_CHANGE_INVALID_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, serializer.validated_data['token']):
            return Response({'detail': EMAIL_CHANGE_INVALID_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=request_obj.new_email).exclude(pk=user.pk).exists():
            return Response({'detail': _de(_('An account with this email already exists.'))}, status=status.HTTP_400_BAD_REQUEST)

        user.email = request_obj.new_email
        user.save(update_fields=['email'])
        request_obj.confirmed_at = timezone.now()
        request_obj.save(update_fields=['confirmed_at', 'updated_at'])
        return Response({'detail': EMAIL_CHANGE_CONFIRMATION_SUCCESS_MESSAGE})


class AccountPasswordChangeView(APIView):
    def post(self, request: Request) -> Response:
        serializer = AccountPasswordChangeSerializer(data=request.data, context={'request': request})
        _validate_serializer_in_german(serializer)

        if not request.user.check_password(serializer.validated_data['current_password']):
            return Response({'detail': _de(_('Invalid password.'))}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        update_session_auth_hash(request, request.user)
        return Response({'detail': PASSWORD_UPDATED_MESSAGE})


class AccountDeleteRequestView(APIView):
    """Mark the authenticated account for delayed deletion after password confirmation."""

    def post(self, request: Request) -> Response:
        serializer = AccountDeleteRequestSerializer(data=request.data)
        _validate_serializer_in_german(serializer)

        user = request.user
        if not user.check_password(serializer.validated_data['password']):
            return Response({'detail': _de(_('Invalid password.'))}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        scheduled = now + timedelta(days=ACCOUNT_DELETION_GRACE_DAYS)
        deletion, created_flag = AccountDeletionRequest.objects.get_or_create(user=user)
        deletion.deletion_requested_at = now
        deletion.scheduled_deletion_at = scheduled
        deletion.save(update_fields=['deletion_requested_at', 'scheduled_deletion_at', 'updated_at'])

        user.is_active = False
        user.save(update_fields=['is_active'])

        logout(request)
        _logout_all_user_sessions(user.id)

        return Response(
            {
                'detail': _de(_('Your account was marked for deletion.')),
                'scheduled_deletion_at': scheduled.isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class AccountRestoreView(APIView):
    """Restore an account that is pending deletion within the grace period."""

    permission_classes = [permissions.AllowAny]

    def post(self, request: Request) -> Response:
        serializer = AccountRestoreSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        email = _normalize_email(serializer.validated_data['email'])
        password = serializer.validated_data['password']

        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.check_password(password):
            return Response({'detail': _de(_('Invalid credentials.'))}, status=status.HTTP_400_BAD_REQUEST)

        deletion = AccountDeletionRequest.objects.filter(user=user).first()
        if deletion is None or not deletion.is_pending or deletion.scheduled_deletion_at is None:
            return Response({'detail': _de(_('No restorable deletion request found.'))}, status=status.HTTP_400_BAD_REQUEST)

        if deletion.scheduled_deletion_at <= timezone.now():
            return Response({'detail': _de(_('The deletion grace period has expired.'))}, status=status.HTTP_400_BAD_REQUEST)

        deletion.clear_schedule()
        user.is_active = True
        user.save(update_fields=['is_active'])

        login(request, user)
        return Response(UserSerializer(user).data)


class AccountStatusView(APIView):
    """Return deletion scheduling state for the authenticated account."""

    def get(self, request: Request) -> Response:
        deletion = AccountDeletionRequest.objects.filter(user=request.user).first()
        return Response(
            {
                'pending_deletion': bool(deletion and deletion.is_pending),
                'scheduled_deletion_at': deletion.scheduled_deletion_at.isoformat() if deletion and deletion.scheduled_deletion_at else None,
                'deleted_at': deletion.deleted_at.isoformat() if deletion and deletion.deleted_at else None,
            }
        )


class ResendActivationView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_resend_activation'

    def post(self, request: Request) -> Response:
        serializer = ResendActivationSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        email = _normalize_email(serializer.validated_data['email'])

        user = User.objects.filter(email__iexact=email).first()
        if user is not None and not user.is_active:
            _set_activation_expiry(user)
            try:
                _send_activation_email(user)
            except Exception:  # noqa: BLE001
                logger.exception('Failed to resend activation email', extra={'user_id': user.id, 'email': user.email})
                return Response(
                    {
                        'code': 'email_send_failed',
                        'message': GENERIC_EMAIL_SEND_FAILED_MESSAGE,
                        'detail': GENERIC_EMAIL_SEND_FAILED_MESSAGE,
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response({'detail': GENERIC_EMAIL_SENT_MESSAGE})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_password_reset_request'

    def post(self, request: Request) -> Response:
        serializer = PasswordResetRequestSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
        email = _normalize_email(serializer.validated_data['email'])

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            try:
                _send_password_reset_email(user)
            except Exception:  # noqa: BLE001
                logger.exception('Failed to send password reset email', extra={'user_id': user.id, 'email': user.email})
                return Response(
                    {
                        'code': 'email_send_failed',
                        'message': GENERIC_EMAIL_SEND_FAILED_MESSAGE,
                        'detail': GENERIC_EMAIL_SEND_FAILED_MESSAGE,
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return Response({'detail': GENERIC_EMAIL_SENT_MESSAGE})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth_password_reset_confirm'

    def post(self, request: Request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        _validate_serializer_in_german(serializer)
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
