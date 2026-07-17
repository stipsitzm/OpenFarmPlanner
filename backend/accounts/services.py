"""Account lifecycle helpers (activation expiry, sessions, token decoding).

Extracted from accounts/views.py so the views only parse requests and map
responses.
"""
from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.utils import timezone, translation
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from .models import PendingActivation
from .serializers import normalize_email_lower

User = get_user_model()
ACTIVATION_EXPIRY_DAYS = 7


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


def _decode_uid(uid: str) -> int | None:
    try:
        return int(force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError):
        return None


def _validate_serializer_in_german(serializer) -> None:
    """Run DRF serializer validation with German locale activated."""
    with translation.override('de'):
        serializer.is_valid(raise_exception=True)
